import { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';
import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { DateTime } from 'src/shared/utils/datetime';
import { UserService } from '../../users/services/user.service';
import { UserDto } from '../../users/dtos/user.dto';
import { TenantService } from '../../tenants/services/tenant.service';
import { EmailUtils } from 'src/shared/utils/email.utils';
import { JwtPayload, TokenUserClaims } from '../jwt/jwt-payload.model';
import { AccessTokenService } from './access-token.service';
import { AuthenticatedUserService } from './authenticated-user.service';
import Users from '../../users/entities/user.entity';
import { UserRole } from 'src/shared/enums/roles';
import { SignInDto } from '../dtos/otp_signin.dto';
import { Sequelize } from 'sequelize-typescript';

interface LoginAttempt {
  count: number;
  last_attempt: string;
  locked: boolean;
  unlock_time: string | null;
}

@Injectable()
export class AuthService {
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_DURATION = 15 * 60 * 1000;
  private readonly MAX_LOGIN_ATTEMPTS_PER_IP = 20;
  private readonly IP_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis_client: Redis,
    private sequelize: Sequelize,
    private readonly user_service: UserService,
    private readonly tenant_service: TenantService,
    private readonly access_token_service: AccessTokenService,
    private readonly authenticated_user_service: AuthenticatedUserService,
  ) {}

  get_user_by_signed_token(token: string) {
    return this.authenticated_user_service.resolve_from_access_token(token);
  }

  async register(user: UserDto): Promise<any> {
    const transaction = await this.sequelize.transaction();

    try {
      if (!(await EmailUtils.is_email(user.email))) {
        throw new HttpException(
          'Invalid email address.',
          HttpStatus.EXPECTATION_FAILED,
        );
      }

      const tenant = await this.tenant_service.find_by_slug(user.tenant_slug);

      const added_user = await this.user_service.create_user(
        {
          email: user.email,
          password: user.password,
          tenant_id: tenant.id,
          role: UserRole.AGENT,
        },
        transaction,
      );

      await transaction.commit();

      const safe_user = this.strip_password(added_user);
      return {
        ...safe_user,
        service_message: 'Registration successful.',
      };
    } catch (error) {
      await transaction.rollback();
      throw new HttpException(
        error?.message || 'Registration failed.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async login(dto: SignInDto, ip?: string): Promise<any> {
    if (ip && (await this.is_ip_rate_limited(ip))) {
      throw new HttpException(
        'Too many login attempts. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [user] = await this.user_data(dto);

    if (!user) {
      if (ip) await this.record_ip_login(ip);
      throw new HttpException('Invalid credentials.', HttpStatus.BAD_REQUEST);
    }

    if (await this.is_account_locked(user.email)) {
      throw new HttpException(
        'Account temporarily locked. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const is_matched = await bcrypt.compare(dto.password, user?.password);

    if (!is_matched) {
      await this.record_failed_login(user.email);
      if (ip) await this.record_ip_login(ip);
      throw new HttpException('Invalid credentials.', HttpStatus.BAD_REQUEST);
    }

    await this.reset_login_attempts(user.email);

    return this.format_auth_response(user, 'Login successful.');
  }

  private async is_ip_rate_limited(ip: string): Promise<boolean> {
    const key = `ip_rate_limit:login:${ip}`;
    const count = parseInt((await this.redis_client.get(key)) || '0');
    return count >= this.MAX_LOGIN_ATTEMPTS_PER_IP;
  }

  private async record_ip_login(ip: string): Promise<void> {
    const key = `ip_rate_limit:login:${ip}`;
    const count = parseInt((await this.redis_client.get(key)) || '0');
    if (count === 0) {
      await this.redis_client.set(key, '1', 'PX', this.IP_RATE_LIMIT_WINDOW_MS);
    } else {
      await this.redis_client.incr(key);
    }
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

  async format_auth_response(
    user: Users,
    service_message?: string,
  ): Promise<any> {
    const { password, ...rest_of_user } = user;
    const access_token = this.encrypt_user_token(rest_of_user);

    return {
      user: rest_of_user,
      tokens: {
        access_token,
        refresh_token: access_token,
      },
      ...(service_message && { service_message }),
    };
  }

  private to_token_claims(user: any): TokenUserClaims {
    if (!user || typeof user !== 'object') return { id: '', email: '' };
    return {
      id: user.id ?? '',
      email: user.email ?? '',
      tenant_id: user.tenant_id ?? undefined,
      role: user.role ?? undefined,
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

  user_data(dto: SignInDto) {
    return Promise.all([
      Users.scope('with_sensitive_data').findOne({
        where: { email: dto.email },
        raw: true,
      }),
    ]);
  }
}
