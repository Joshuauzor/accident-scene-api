import { randomBytes } from 'crypto';
import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { configs } from '../../../../config/config.env';
import { DateTime } from 'src/shared/utils/datetime';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserService } from '../../users/services/user.service';
import { UserDto, UsernameDto } from '../../users/dtos/user.dto';
import { RegisterWithInvitationDto } from '../dtos/register-with-invitation.dto';
import { GenTokenDto } from '../dtos/generate_token.dto';
import { EmailUtils } from 'src/shared/utils/email.utils';
import { JwtPayload, TokenUserClaims } from '../jwt/jwt-payload.model';
import { AccessTokenService } from './access-token.service';
import { AuthenticatedUserService } from './authenticated-user.service';
import Users from '../../users/entities/user.entity';
import {
  ResetOtpDto,
  OtpSignInDto,
  ResendDto,
  ForgotOtpDto,
} from '../dtos/otp_signin.dto';
import { VerifyOtpDto } from '../dtos/veriy_otp.dto';
import {
  otp_mail_template,
  welcome_mail_template,
} from 'src/shared/templates/opt';
import { NotificationEvents } from 'src/shared/events/notification.events';
import { SettingEvents } from 'src/shared/events/setting.events';
import { AccessCodeService } from 'src/modules/accesscode/services/accesscode.service';
import { Sequelize } from 'sequelize-typescript';
import { EventsService } from 'src/modules/events/services/event.service';
import { MarketPlaceService } from 'src/modules/marketplace/services/marketplace.service';
import { AccountStatus } from 'src/shared/enums/roles';
import {
  get_blocked_account_message,
  is_blocked_account_status,
} from 'src/shared/utils/account-status.utils';
import { resolve_oauth_profile_image } from 'src/shared/utils/profile-image.utils';

interface LoginAttempt {
  count: number;
  last_attempt: string;
  locked: boolean;
  unlock_time: string | null;
}

@Injectable()
export class AuthService {
  private readonly jwt_private_key: string;
  private readonly otp_expiry_time: number;
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_DURATION = 15 * 60 * 1000;
  private readonly OTP_MAX_REQUESTS = 3;
  private readonly OTP_WINDOW_MS = 15 * 60 * 1000;
  private readonly OTP_VERIFY_MAX_ATTEMPTS = 5;
  private readonly OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
  private readonly MAX_OTP_REQUESTS_PER_IP = 10;
  private readonly MAX_LOGIN_ATTEMPTS_PER_IP = 20;
  private readonly MAX_PASSWORD_RESET_PER_IP = 5;
  private readonly IP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis_client: Redis,
    private auth_events: EventEmitter2,
    private sequelize: Sequelize,
    private readonly user_service: UserService,
    private readonly user_access_service: AccessCodeService,
    private readonly events_service: EventsService,
    private readonly marketplace_service: MarketPlaceService,
    private readonly access_token_service: AccessTokenService,
    private readonly authenticated_user_service: AuthenticatedUserService,
  ) {
    this.jwt_private_key = configs.JWT_SECRET;
    this.otp_expiry_time = 10 * 60 * 1000;
  }

  private normalize_email(email?: string | null): string {
    return EmailUtils.normalize_email(email);
  }

  static generate_otp(length: number): string {
    const digits = '0123456789';
    let OTP = '';

    while (OTP.length < length) {
      OTP += digits[Math.floor(Math.random() * digits.length)];
    }

    return OTP;
  }

  async generate_and_store_otp(email: string, length: number): Promise<string> {
    const otp = AuthService.generate_otp(length);
    const expiration_time = this.otp_expiry_time / 1000;
    await this.redis_client.set(
      `otp:${email}`,
      JSON.stringify({ otp }),
      'EX',
      expiration_time,
    );
    return otp;
  }

  async can_request_otp(email: string, type?: string): Promise<boolean> {
    const key = `${type || 'otp'}_requests:${email}`;
    const request_count = await this.redis_client.get(key);

    return (parseInt(request_count) || 0) > this.OTP_MAX_REQUESTS;
  }

  async record_otp_request(email: string, type?: string): Promise<void> {
    const key = `${type || 'otp'}_requests:${email}`;
    const request_count = parseInt((await this.redis_client.get(key)) || '0');

    if (request_count === 0) {
      await this.redis_client.set(key, '1', 'PX', this.OTP_WINDOW_MS);
    } else {
      await this.redis_client.incr(key);
    }
  }

  async can_verify_otp(email: string): Promise<boolean> {
    const key = `otp_verify_attempts:${email}`;
    const attempt_count = await this.redis_client.get(key);
    return (parseInt(attempt_count) || 0) >= this.OTP_VERIFY_MAX_ATTEMPTS;
  }

  async record_otp_verify_attempt(
    email: string,
    success: boolean,
  ): Promise<void> {
    const key = `otp_verify_attempts:${email}`;
    if (success) {
      await this.redis_client.del(key);
    } else {
      const attempt_count = parseInt((await this.redis_client.get(key)) || '0');
      if (attempt_count === 0) {
        await this.redis_client.set(key, '1', 'PX', this.OTP_VERIFY_WINDOW_MS);
      } else {
        await this.redis_client.incr(key);
      }
    }
  }

  async can_request_by_ip(
    ip: string,
    type: 'otp' | 'login' | 'password_reset',
  ): Promise<boolean> {
    const limits = {
      otp: this.MAX_OTP_REQUESTS_PER_IP,
      login: this.MAX_LOGIN_ATTEMPTS_PER_IP,
      password_reset: this.MAX_PASSWORD_RESET_PER_IP,
    };
    const key = `ip_rate_limit:${type}:${ip}`;
    const count = parseInt((await this.redis_client.get(key)) || '0');
    return count >= limits[type];
  }

  async record_ip_request(
    ip: string,
    type: 'otp' | 'login' | 'password_reset',
  ): Promise<void> {
    const key = `ip_rate_limit:${type}:${ip}`;
    const count = parseInt((await this.redis_client.get(key)) || '0');
    if (count === 0) {
      await this.redis_client.set(key, '1', 'PX', this.IP_RATE_LIMIT_WINDOW_MS);
    } else {
      await this.redis_client.incr(key);
    }
  }

  get_user_by_signed_token(token: string) {
    return this.authenticated_user_service.resolve_from_access_token(token);
  }

  async validate_otp(email: string, otp: string): Promise<boolean> {
    const stored_otp_data = await this.redis_client.get(`otp:${email}`);
    if (!stored_otp_data) return false;

    const { otp: stored_otp } = JSON.parse(stored_otp_data);
    if (stored_otp === otp) {
      await this.redis_client.del(`otp:${email}`);
      return true;
    }
    return false;
  }

  async is_otp_verified(
    user_id: string | null,
    email?: string,
  ): Promise<boolean> {
    const normalized_email = email?.toLowerCase().trim();

    if (user_id) {
      const key = `registration_verified:${user_id}`;
      const registration_verified = await this.redis_client.get(key);
      if (registration_verified) {
        return true;
      }
    }

    if (normalized_email) {
      const key = `registration_verified:${normalized_email}`;
      const registration_verified = await this.redis_client.get(key);
      if (registration_verified) {
        return true;
      }
    }

    if (user_id) {
      const key = `otp_verified:${user_id}`;
      const verified_by_id = await this.redis_client.get(key);
      if (verified_by_id) {
        return true;
      }
    }

    if (normalized_email) {
      const key = `otp_verified:${normalized_email}`;
      const verified_by_email = await this.redis_client.get(key);
      if (verified_by_email) {
        return true;
      }
    }

    return false;
  }

  async has_registration_verification(
    user_id: string | null,
    email?: string,
  ): Promise<boolean> {
    const normalized_email = email?.toLowerCase().trim();

    if (user_id) {
      const key = `registration_verified:${user_id}`;
      const registration_verified = await this.redis_client.get(key);
      if (registration_verified) {
        return true;
      }
    }

    if (normalized_email) {
      const key = `registration_verified:${normalized_email}`;
      const registration_verified = await this.redis_client.get(key);
      if (registration_verified) {
        return true;
      }
    }

    return false;
  }

  async has_recent_otp_verification(
    user_id: string | null,
    email?: string,
  ): Promise<boolean> {
    const normalized_email = email?.toLowerCase().trim();

    if (user_id) {
      const key = `otp_verified:${user_id}`;
      const verified_by_id = await this.redis_client.get(key);
      if (verified_by_id) {
        return true;
      }
    }

    if (normalized_email) {
      const key = `otp_verified:${normalized_email}`;
      const verified_by_email = await this.redis_client.get(key);
      if (verified_by_email) {
        return true;
      }
    }

    return false;
  }

  async register(new_user: UserDto): Promise<any> {
    const transaction = await this.sequelize.transaction();

    try {
      new_user.email = this.normalize_email(new_user.email);

      if (!(await EmailUtils.validate_email(new_user.email))) {
        throw new HttpException(
          'Invalid email address.',
          HttpStatus.EXPECTATION_FAILED,
        );
      }

      new_user.phone_number =
        new_user?.phone_number &&
        (await EmailUtils.validate_and_sanitize_phone(new_user.phone_number));

      new_user.account_status = AccountStatus.PENDING_VERIFICATION;

      const added_user = await this.user_service.add_user(
        new_user,
        transaction,
      );

      this.auth_events.emit(
        SettingEvents.GENERATE_REFERRAL_CODE,
        added_user.id,
      );

      if (added_user.is_active) {
        throw new HttpException(
          'Account already verified. Please login instead.',
          HttpStatus.PRECONDITION_FAILED,
        );
      }

      const otp = await this.generate_and_store_otp(new_user.email, 4);

      const normalized_reg_email = new_user.email.toLowerCase().trim();
      await this.redis_client.set(
        `registration_otp:${normalized_reg_email}`,
        'true',
        'EX',
        this.otp_expiry_time / 1000,
      );

      await this.user_access_service.create_or_update(
        added_user.id,
        {
          otp,
          user_id: added_user.id,
        },
        transaction,
      );

      await transaction.commit();

      if (new_user.referral_code) {
        this.auth_events.emit(SettingEvents.PROCESS_REFERRAL, {
          referee_id: added_user.id,
          referral_code: new_user.referral_code,
        });
      }

      this.auth_events.emit(
        NotificationEvents.SEND,
        await otp_mail_template(otp, new_user.email),
      );

      const safe_user = this.strip_password(added_user);
      return {
        ...safe_user,
        otp: configs.NODE_ENV === 'production' ? otp : otp,
        service_message:
          'Registration successful. Please check your email for OTP verification.',
      };
    } catch (error) {
      await transaction.rollback();
      throw new HttpException(
        error?.message || 'Kindly retry in a few moment',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async register_with_invitation(
    payload: RegisterWithInvitationDto,
  ): Promise<any> {
    const { token, ...rest } = payload;
    const registration_data = {
      email: rest.email,
      full_name: rest.full_name,
      username: rest.username,
      image: rest.image,
      phone_number: rest.phone_number,
      password: rest.password,
      confirm_password: rest.confirm_password,
      role: rest.role,
    } as UserDto;

    const registration_result = await this.register(registration_data);

    const invitation_result = await this.process_invitation_token(
      token,
      registration_result.id,
      registration_result.email,
    );

    return {
      ...registration_result,
      invitation_result,
    };
  }

  private async process_invitation_token(
    token: string,
    user_id: string,
    email: string,
  ): Promise<{ type: string; success: boolean; message?: string } | null> {
    try {
      const manager_token_data =
        this.events_service.validate_invitation_token(token);
      if (manager_token_data && manager_token_data.email === email) {
        await this.events_service.add_event_manager({
          email,
          event_id: manager_token_data.event_id,
        });
        return {
          type: 'event_manager',
          success: true,
          message: 'You have been added as an event manager.',
        };
      }

      const transfer_token_data =
        this.marketplace_service.validate_transfer_token(token);
      if (transfer_token_data && transfer_token_data.email === email) {
        await this.marketplace_service.complete_ticket_transfer_from_token(
          transfer_token_data.ticket_instance_id,
          transfer_token_data.event_id,
          user_id,
          email,
        );
        return {
          type: 'ticket_transfer',
          success: true,
          message: 'Ticket has been transferred to your account.',
        };
      }

      return null;
    } catch (error) {
      return {
        type: 'unknown',
        success: false,
        message: 'Failed to process invitation. Please contact support.',
      };
    }
  }

  async username_check(user, user_check: UsernameDto): Promise<any> {
    const username = user_check.username.toLowerCase();
    const existing_user = await this.user_service.find_one({
      where: { username },
    });

    const { password: _, ...rest_of_user } = user;
    const access_token = this.encrypt_user_token(rest_of_user);

    if (!existing_user) {
      return {
        user: rest_of_user,
        tokens: { access_token, refresh_token: access_token },
        username_check: {
          exists: false,
          username,
          suggestions: [],
        },
      };
    }

    const suggestions = user?.full_name?.trim()
      ? await this.user_service.generate_username(user.full_name, true)
      : this.generate_simple_suggestions(username);

    return {
      user: rest_of_user,
      tokens: { access_token, refresh_token: access_token },
      username_check: {
        exists: true,
        username,
        suggestions: Array.isArray(suggestions) ? suggestions : [suggestions],
      },
    };
  }

  private generate_simple_suggestions(base_username: string): string[] {
    const base = base_username.toLowerCase().replace(/[^a-z0-9_]/g, '');
    const timestamp = Date.now();
    return [
      `${base}_${timestamp % 10000}`,
      `${base}_${Math.floor(Math.random() * 10000)}`,
      `user_${timestamp}_${Math.floor(Math.random() * 1000)}`,
    ];
  }

  async generate_access_token(gen_token_dto: GenTokenDto) {
    gen_token_dto.email = this.normalize_email(gen_token_dto.email);
    const user = await this.user_service.find_by_email(gen_token_dto.email);

    if (!user) {
      throw new HttpException(
        'Invalid email or password.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const match = await bcrypt.compare(gen_token_dto.password, user.password);
    if (!match) {
      throw new HttpException(
        'Invalid email or password.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (is_blocked_account_status(user.account_status)) {
      throw new HttpException(
        get_blocked_account_message(user.account_status),
        HttpStatus.FORBIDDEN,
      );
    }

    const safe_user = this.strip_password(user);
    const access_token = this.encrypt_user_token(safe_user);
    return { ...safe_user, tokens: { access_token } };
  }

  async sign_token(user: Users) {
    const payload: JwtPayload = {
      user: this.to_token_claims(user),
    };
    return sign(payload, this.jwt_private_key, {});
  }

  private to_token_claims(user: any): TokenUserClaims {
    if (!user || typeof user !== 'object') return { id: '', email: '' };
    return {
      id: user.id ?? '',
      email: user.email ?? '',
    };
  }

  private strip_password(user: any): any {
    if (!user || typeof user !== 'object') return user;
    const rest = { ...user };
    delete rest.password;
    return rest;
  }

  encrypt_user_token(user: any): string {
    const payload: JwtPayload = { user: this.to_token_claims(user) };
    return this.access_token_service.encrypt(payload);
  }

  async format_auth_response(
    user: Users,
    service_message?: string,
    include_dashboard_stats = true,
  ): Promise<any> {
    const user_data = await this.user_service.get_formatted_user_with_stats(
      user.id,
      user.id,
      include_dashboard_stats,
      { suspension_for_viewer_id: user.id },
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest_of_user } = user_data;
    const access_token = this.encrypt_user_token(rest_of_user);

    const tokens = {
      access_token,
      refresh_token: access_token,
    };

    return {
      user: rest_of_user,
      tokens,
      ...(service_message && { service_message }),
    };
  }

  async login(dto: OtpSignInDto, ip?: string): Promise<any> {
    dto.email = this.normalize_email(dto.email);

    if (ip && (await this.can_request_by_ip(ip, 'login'))) {
      throw new HttpException(
        'Too many login attempts from this IP. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user] = await this.user_details(dto);

    if (!user) {
      if (ip) await this.record_ip_request(ip, 'login');
      throw new HttpException('Invalid credentials.', HttpStatus.BAD_REQUEST);
    }

    if (await this.is_account_locked(user.email)) {
      throw new HttpException(
        'Account is temporarily locked due to too many failed attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const is_matched = await bcrypt.compare(dto.password, user?.password);

    if (!is_matched) {
      await this.record_failed_login(user.email);
      if (ip) await this.record_ip_request(ip, 'login');
      throw new HttpException('Invalid credentials.', HttpStatus.BAD_REQUEST);
    }

    if (is_blocked_account_status(user.account_status)) {
      throw new HttpException(
        get_blocked_account_message(user.account_status),
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.is_active) {
      if (await this.can_request_otp(dto.email)) {
        throw new HttpException(
          'Too many OTP requests. Please try again later.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      const otp = await this.generate_and_store_otp(dto.email, 4);
      if (ip) await this.record_ip_request(ip, 'otp');

      await this.user_access_service.create_or_update(user.id, {
        otp,
        user_id: user.id,
      });

      await this.record_otp_request(dto.email);

      this.auth_events.emit(
        NotificationEvents.SEND,
        await otp_mail_template(otp, dto.email),
      );

      return {
        user: this.strip_password(user),
        otp: configs.NODE_ENV === 'production' ? otp : otp,
        service_message:
          'Account is inactive. Please verify your email with the OTP sent to your mailbox.',
      };
    }

    await this.reset_login_attempts(user.email);

    const normalized_email = user.email.toLowerCase().trim();
    await this.redis_client.del(`otp_verified:${user.id}`);
    await this.redis_client.del(`otp_verified:${normalized_email}`);

    return this.format_auth_response(user, 'login successful 🤍.');
  }

  async send_otp(dto: ResendDto, ip?: string): Promise<any> {
    dto.email = this.normalize_email(dto.email);

    if (ip && (await this.can_request_by_ip(ip, 'otp'))) {
      throw new HttpException(
        'Too many OTP requests from this IP. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user] = await this.user_details(dto);

    if (!user) {
      if (ip) await this.record_ip_request(ip, 'otp');
      throw new HttpException('Invalid email address.', HttpStatus.BAD_REQUEST);
    }

    if (await this.can_request_otp(dto.email)) {
      if (ip) await this.record_ip_request(ip, 'otp');
      throw new HttpException(
        'Too many OTP requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = await this.generate_and_store_otp(dto.email, 4);
    if (ip) await this.record_ip_request(ip, 'otp');

    await this.user_access_service.create_or_update(user.id, {
      otp,
      user_id: user.id,
    });

    this.record_otp_request(dto.email);

    this.auth_events.emit(
      NotificationEvents.SEND,
      await otp_mail_template(otp, dto.email),
    );

    return {
      otp: configs.NODE_ENV === 'production' ? otp : otp,
      service_message: 'Kindly check your mailbox for the OTP',
    };
  }

  async verify_otp(otp_dto: VerifyOtpDto): Promise<any> {
    otp_dto.email = this.normalize_email(otp_dto.email);

    if (await this.can_verify_otp(otp_dto.email)) {
      throw new HttpException(
        'Too many OTP verification attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user] = await this.user_details(otp_dto);

    if (!user) {
      await this.record_otp_verify_attempt(otp_dto.email, false);
      throw new HttpException(
        'Invalid user or otp',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const tokenized_user = await this.user_access_service.find_user(user.id);

    if (+tokenized_user.otp !== +otp_dto.otp) {
      await this.record_otp_verify_attempt(otp_dto.email, false);
      throw new HttpException(
        'Invalid user or otp',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    if (!(await this.validate_otp(otp_dto.email, otp_dto.otp + ''))) {
      await this.record_otp_verify_attempt(otp_dto.email, false);
      throw new HttpException(
        'Invalid or expired otp.',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    await this.record_otp_verify_attempt(otp_dto.email, true);

    await this.user_access_service.update_access_code({
      otp: null,
      user_id: user.id,
    });

    await this.user_service.update_one_by_email(user.email, {
      is_active: true,
      account_status: AccountStatus.PENDING_PROFILE,
    });

    user.is_active = true;
    user.account_status = AccountStatus.PENDING_PROFILE;

    const verification_ttl = 30 * 60;
    const normalized_email = user.email.toLowerCase().trim();

    await this.redis_client.set(
      `otp_verified:${user.id}`,
      JSON.stringify({
        email: normalized_email,
        verified_at: DateTime.now_iso(),
      }),
      'EX',
      verification_ttl,
    );

    await this.redis_client.set(
      `otp_verified:${normalized_email}`,
      JSON.stringify({
        user_id: user.id,
        verified_at: DateTime.now_iso(),
      }),
      'EX',
      verification_ttl,
    );

    const normalized_otp_email = otp_dto.email.toLowerCase().trim();
    const is_registration_otp = await this.redis_client.get(
      `registration_otp:${normalized_otp_email}`,
    );

    if (is_registration_otp) {
      await this.redis_client.del(`registration_otp:${normalized_otp_email}`);

      const normalized_email = user.email.toLowerCase().trim();

      const user_id_key = `registration_verified:${user.id}`;
      await this.redis_client.set(
        user_id_key,
        JSON.stringify({
          email: normalized_email,
          verified_at: DateTime.now_iso(),
          type: 'registration',
        }),
      );

      const email_key = `registration_verified:${normalized_email}`;
      await this.redis_client.set(
        email_key,
        JSON.stringify({
          user_id: user.id,
          verified_at: DateTime.now_iso(),
          type: 'registration',
        }),
      );

      this.auth_events.emit(
        NotificationEvents.SEND,
        await welcome_mail_template(user.email),
      );
    }

    return this.format_auth_response(user, 'OTP successfully verified.');
  }

  async forgot_password(dto: ForgotOtpDto, ip?: string): Promise<any> {
    dto.email = this.normalize_email(dto.email);

    if (ip && (await this.can_request_by_ip(ip, 'password_reset'))) {
      throw new HttpException(
        'Too many password reset attempts. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user] = await this.user_details({
      email: dto.email,
    } as OtpSignInDto);
    if (!user) {
      if (ip) await this.record_ip_request(ip, 'password_reset');
      throw new HttpException('Invalid user account.', HttpStatus.BAD_REQUEST);
    }

    const hashed_password = await bcrypt.hash(dto.confirm_password, 12);

    await this.user_service.update_one_by_email(dto.email, {
      password: hashed_password,
      is_active: true,
      account_status: AccountStatus.ACTIVE,
    });

    if (ip) {
      await this.record_ip_request(ip, 'password_reset');
    }

    const normalized_email = user.email.toLowerCase().trim();
    await this.redis_client.del(`otp_verified:${user.id}`);
    await this.redis_client.del(`otp_verified:${normalized_email}`);
    await this.redis_client.del(`registration_verified:${user.id}`);
    await this.redis_client.del(`registration_verified:${normalized_email}`);

    user.is_active = true;
    user.account_status = AccountStatus.ACTIVE;
    return this.format_auth_response(
      user,
      'Password successfully retrieved. 💚',
    );
  }

  async reset_password(user: Users, dto: ResetOtpDto): Promise<string> {
    const [verified_user] = await this.user_details({
      email: user.email,
    } as OtpSignInDto);
    if (!verified_user) {
      throw new HttpException('Invalid user account.', HttpStatus.BAD_REQUEST);
    }

    const is_password_valid = await bcrypt.compare(
      dto.current_password,
      verified_user.password,
    );
    if (!is_password_valid)
      throw new HttpException(
        'Current password is incorrect',
        HttpStatus.BAD_REQUEST,
      );

    if (dto.current_password === dto.confirm_password)
      throw new HttpException(
        'Cannot reset password to current password, use a different password',
        HttpStatus.BAD_REQUEST,
      );

    const hashed_password = await bcrypt.hash(dto.confirm_password, 12);

    await this.user_service.update_one_by_email(user.email, {
      password: hashed_password,
      is_active: true,
      account_status: AccountStatus.ACTIVE,
    });

    return 'Password reset successful. 💚';
  }

  async is_account_locked(email: string): Promise<boolean> {
    const attempt_data = await this.redis_client.get(`loginAttempts:${email}`);
    if (!attempt_data) return false;

    const attempt: LoginAttempt = JSON.parse(attempt_data);
    if (attempt.locked) {
      if (DateTime.is_past(attempt.unlock_time!)) {
        await this.reset_login_attempts(email);
        return false;
      }
      return true;
    }
    return false;
  }

  async record_failed_login(email: string): Promise<void> {
    const key = `loginAttempts:${email}`;
    const attempt_data = await this.redis_client.get(key);

    const attempt: LoginAttempt = attempt_data
      ? JSON.parse(attempt_data)
      : {
          count: 0,
          last_attempt: DateTime.now_iso(),
          locked: false,
          unlock_time: null,
        };

    attempt.count += 1;
    attempt.last_attempt = DateTime.now_iso();

    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.locked = true;
      attempt.unlock_time = new Date(
        Date.now() + this.LOCK_DURATION,
      ).toISOString();
    }

    await this.redis_client.set(
      key,
      JSON.stringify(attempt),
      'PX',
      this.LOCK_DURATION * 2,
    );
  }

  async reset_login_attempts(email: string): Promise<void> {
    await this.redis_client.del(`loginAttempts:${email}`);
  }

  user_details(dto) {
    const normalized_email = this.normalize_email(dto.email);
    return Promise.all([
      Users.scope('with_sensitive_data').findOne({
        where: {
          email: normalized_email,
        },
        raw: true,
      }),
    ]);
  }

  async handle_oauth_login(profile: {
    email?: string;
    first_name?: string;
    last_name?: string;
    image?: string;
    provider: string;
    provider_id: string;
  }) {
    const email = this.normalize_email(profile.email);
    if (!email) {
      throw new HttpException(
        'Email or user identifier is required for OAuth login',
        HttpStatus.BAD_REQUEST,
      );
    }
    const transaction = await this.sequelize.transaction();
    try {
      let user = await this.user_service.find_by_email_including_deleted(
        email,
        transaction,
      );

      if (!user) {
        const full_name =
          [profile.first_name, profile.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() || '';
        user = await this.user_service.add_user(
          {
            email,
            full_name,
            password: randomBytes(32).toString('hex'),
            oauth_provider: profile.provider,
            provider_id: profile.provider_id,
            is_active: true,
            account_status: AccountStatus.PENDING_PROFILE,
            image: profile?.image,
          },
          transaction,
        );
        this.auth_events.emit(SettingEvents.GENERATE_REFERRAL_CODE, user.id);
      } else if (user.deleted_at) {
        const oauth_image = resolve_oauth_profile_image(
          user.image,
          profile.image,
        );
        await this.user_service.restore_oauth_user(
          user.id,
          {
            is_active: true,
            account_status: AccountStatus.PENDING_PROFILE,
            oauth_provider: profile.provider,
            provider_id: profile.provider_id,
            ...(oauth_image && { image: oauth_image }),
          },
          transaction,
        );
        user.deleted_at = null;
        user.is_active = true;
        user.account_status = AccountStatus.PENDING_PROFILE;
        user.oauth_provider = profile.provider;
        user.provider_id = profile.provider_id;
        if (oauth_image) user.image = oauth_image;
      } else {
        if (is_blocked_account_status(user.account_status)) {
          await transaction.rollback();
          throw new HttpException(
            get_blocked_account_message(user.account_status),
            HttpStatus.FORBIDDEN,
          );
        }
        const oauth_image = resolve_oauth_profile_image(
          user.image,
          profile.image,
        );
        const updates: Record<string, unknown> = {
          is_active: true,
          oauth_provider: profile.provider,
          provider_id: profile.provider_id,
          ...(oauth_image && { image: oauth_image }),
        };
        if (user.account_status !== AccountStatus.ACTIVE) {
          updates.account_status = AccountStatus.PENDING_PROFILE;
          user.account_status = AccountStatus.PENDING_PROFILE;
        }
        await this.user_service.update_one_by_email(
          user.email,
          updates,
          transaction,
        );
      }

      await transaction.commit();
      return this.format_auth_response(user, 'OAuth login successful.');
    } catch (error) {
      await transaction.rollback();
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        (error as Error)?.message || 'Failed to handle OAuth login',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
  }
}
