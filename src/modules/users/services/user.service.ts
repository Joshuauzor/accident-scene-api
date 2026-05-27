/* eslint-disable @typescript-eslint/no-empty-function */
import * as bcrypt from 'bcrypt';
import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { AesEncryption } from 'src/shared/utils/encryption';
import { configs } from '../../../../config/config.env';
import { ProfileDto } from '../dtos/user.dto';
import { EmailUtils } from 'src/shared/utils/email.utils';
import { UserRepository } from '../repositories/user.repository';
import Users from '../entities/user.entity';
import { AuthService } from 'src/modules/authentication/services/auth.service';
import { SearchFilterOptions } from 'src/shared/types/types';
import { FindDataRequestDto } from 'src/shared/utils/dtos/find.data.request.dto';
import { PaginationData } from 'src/shared/types/pagination';
import { search_filter } from 'src/shared/utils/pagination';
import { Transaction } from 'sequelize';
import { UpdateEmailData, UsersDto } from '../interface/users.inteface';
import { Sequelize } from 'sequelize-typescript';
import { AccountStatus } from 'src/shared/enums/roles';
import {
  AuthUserCacheInvalidateOptions,
  AuthUserCacheService,
} from 'src/global/services/cache/auth-user-cache.service';

@Injectable()
export class UserService {
  private encryption = new AesEncryption(configs.ENCRYPTION_PRIVATE_KEY);

  constructor(
    private readonly sequelize: Sequelize,
    private readonly user_repo: UserRepository,
    @Inject(forwardRef(() => AuthService))
    private readonly auth_service: AuthService,
    @Inject('REDIS_CLIENT') private readonly redis_client: Redis,
    private readonly auth_user_cache: AuthUserCacheService,
  ) {}

  private invalidate_auth_user_cache(
    options: AuthUserCacheInvalidateOptions,
  ): void {
    void this.auth_user_cache.invalidate(options);
  }

  private validate_user_existence(
    exist: Users | null,
    user_dto: Partial<Pick<UsersDto, 'username' | 'email' | 'phone_number'>>,
    current_user_id?: string,
  ): void {
    if (!exist) return;

    const is_same_user = current_user_id && exist.id === current_user_id;
    if (is_same_user) return;

    if (
      exist?.username?.toLocaleLowerCase() ===
      user_dto?.username?.toLocaleLowerCase()
    ) {
      throw new HttpException(
        'Sorry! Kindly use a different username. 🙂',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
    if (
      exist?.email?.toLocaleLowerCase() === user_dto?.email?.toLocaleLowerCase()
    ) {
      throw new HttpException(
        'Sorry! Kindly use a different email address. 🙂',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
    if (exist?.phone_number === user_dto?.phone_number) {
      throw new HttpException(
        'Sorry! Kindly use a different phone number. 🙂',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
  }

  private sanitize_user_existence(
    exist: Users | null,
    user_dto: UsersDto,
    current_user_id?: string,
  ): boolean | void {
    if (!exist) return false;

    const is_same_user = current_user_id && exist.id === current_user_id;
    if (is_same_user) return false;

    if (
      exist?.email?.toLocaleLowerCase() === user_dto?.email?.toLocaleLowerCase()
    ) {
      return true;
    }
    if (
      exist?.username?.toLocaleLowerCase() ===
      user_dto?.username?.toLocaleLowerCase()
    ) {
      throw new HttpException(
        'Sorry! Kindly use a different username. 🙂',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
    if (exist?.phone_number === user_dto?.phone_number) {
      throw new HttpException(
        'Sorry! Kindly use a different phone number. 🙂',
        HttpStatus.PRECONDITION_FAILED,
      );
    }
  }

  private normalize_name_part(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD') // Normalize diacritics
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, ''); // Remove special chars
  }

  private sanitize_username(value: string): string {
    return (value ?? '').trim().replace(/\s+/g, '');
  }

  private async generate_fallback_username(
    email?: string,
    transaction?: Transaction,
  ): Promise<string> {
    let base = 'user';

    if (email) {
      const email_part = email.split('@')[0].toLowerCase();
      base = email_part.replace(/[^a-z0-9_]/g, '').substring(0, 20) || 'user';
    }

    for (let attempt = 0; attempt < 10; attempt++) {
      const random = Math.floor(Math.random() * 10000);
      const username = `${base}_${random}`;

      const exists = await this.user_repo.find_one(
        { where: { username } },
        transaction,
      );

      if (!exists) {
        return username;
      }
    }

    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000);
    return `${base}_${timestamp}_${random}`;
  }

  private async hash_password(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }

  async add_user(
    user_dto: UsersDto,
    transaction?: Transaction,
  ): Promise<Omit<Users, 'password'>> {
    try {
      const exist = await this.user_repo.search_user(
        user_dto,
        null,
        transaction,
      );

      const is_sanitized = await this.sanitize_user_existence(exist, user_dto);

      if (is_sanitized) {
        return exist;
      }

      if (!user_dto?.username?.trim()) {
        user_dto.username = user_dto?.full_name?.trim()
          ? ((await this.generate_username(
              user_dto.full_name,
              false,
              transaction,
            )) as string)
          : await this.generate_fallback_username(user_dto.email, transaction);
      } else {
        user_dto.username = this.sanitize_username(user_dto.username);
        if (!user_dto.username) {
          user_dto.username = await this.generate_fallback_username(
            user_dto.email,
            transaction,
          );
        }
      }

      user_dto.password = await this.hash_password(user_dto.password);

      const create_payload: Partial<Users> = {
        email: user_dto.email,
        username: user_dto.username,
        password: user_dto.password,
        full_name: user_dto.full_name ?? null,
        phone_number: user_dto.phone_number ?? null,
        account_status: user_dto.account_status,
        ...(user_dto.is_active !== undefined && {
          is_active: user_dto.is_active,
        }),
        ...(user_dto.oauth_provider !== undefined && {
          oauth_provider: user_dto.oauth_provider,
        }),
        ...(user_dto.provider_id !== undefined && {
          provider_id: user_dto.provider_id,
        }),
        ...(user_dto.image !== undefined && { image: user_dto.image }),
      };
      const created = await this.save(create_payload, transaction);

      return created;
    } catch (error) {
      throw new HttpException(
        error.message || 'Oops, registration failed, kindly retry in a moment.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async generate_username(
    full_name: string,
    multiple = false,
    transaction?: Transaction,
  ): Promise<string | string[]> {
    if (!full_name?.trim()) {
      throw new HttpException(
        'Full name is required to generate a username',
        HttpStatus.BAD_REQUEST,
      );
    }

    const clean_name = full_name.trim().replace(/\s+/g, ' ');
    const name_parts = clean_name.split(' ');
    const first_name = this.normalize_name_part(name_parts[0]);
    const last_name = this.normalize_name_part(
      name_parts[name_parts.length - 1],
    );

    const base_usernames = [
      `${first_name}${last_name}`,
      `${first_name}_${last_name}`,
      `${first_name.charAt(0)}${last_name}`,
      `${first_name}${last_name.charAt(0)}`,
      `${first_name}${Math.floor(Math.random() * 100)}`,
    ];

    const generated_usernames: string[] = [];

    for (const base of base_usernames) {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const username =
          attempt === 1 ? base : `${base}${Math.floor(Math.random() * 1000)}`;

        const exists = await this.user_repo.find_one(
          {
            where: { username },
          },
          transaction,
        );

        if (!exists && !generated_usernames.includes(username)) {
          if (!multiple) return username;

          generated_usernames.push(username);
          if (generated_usernames.length === 3) {
            return generated_usernames;
          }
        }
      }
    }

    if (multiple) {
      while (generated_usernames.length < 3) {
        const fallback = await this.generate_fallback_username(
          undefined,
          transaction,
        );
        if (!generated_usernames.includes(fallback)) {
          generated_usernames.push(fallback);
        }
      }
      return generated_usernames;
    }

    return await this.generate_fallback_username(undefined, transaction);
  }

  find_one(find_opts, transaction?: Transaction): Promise<Users> {
    return this.user_repo.find_one(find_opts, transaction);
  }

  find_by_email(email: string, transaction?: Transaction): Promise<Users> {
    const normalized_email = EmailUtils.normalize_email(email);
    return this.find_one(
      {
        where: { email: normalized_email },
      },
      transaction,
    );
  }

  async find_by_email_for_auth(email: string): Promise<Users | null> {
    const cached = await this.auth_user_cache.get_or_load(email, () =>
      this.find_by_email(email),
    );
    return cached ? (cached as unknown as Users) : null;
  }

  find_by_email_including_deleted(
    email: string,
    transaction?: Transaction,
  ): Promise<Users | null> {
    const normalized_email = EmailUtils.normalize_email(email);
    return this.user_repo.find_one_by_email_including_deleted(
      normalized_email,
      transaction,
    );
  }

  find_by_email_or_username(
    email_or_username: string,
    transaction?: Transaction,
  ): Promise<Users> {
    return this.user_repo.find_by_email_or_username(
      email_or_username,
      transaction,
    );
  }

  find_by_id(id: string, current_user_id?: string, transaction?: Transaction) {
    const query_options: any = { where: { id } };

    const computed_attributes = [
      [
        Sequelize.literal(`(${UserSqlQueries.HAS_PASSCODE(id)})`),
        'has_passcode',
      ],
    ];

    if (current_user_id && current_user_id !== id) {
      computed_attributes.push(
        [
          Sequelize.literal(
            `(${UserSqlQueries.IS_FOLLOWING(current_user_id, id)})`,
          ),
          'is_following',
        ],
        [
          Sequelize.literal(
            `(${UserSqlQueries.I_BLOCKED_USER(current_user_id, id)})`,
          ),
          'i_blocked_user',
        ],
        [
          Sequelize.literal(
            `(${UserSqlQueries.USER_BLOCKED_ME(current_user_id, id)})`,
          ),
          'user_blocked_me',
        ],
      );
    }

    query_options.attributes = {
      exclude: ['password'],
      include: computed_attributes,
    };

    return this.find_one(query_options, transaction);
  }

  find_x_user(find_opts) {
    return this.find_one(find_opts);
  }

  async user_check(email: string) {
    const normalized_email = EmailUtils.normalize_email(email);
    if (!normalized_email) return null;

    const user = await this.user_repo.find_one({
      where: { email: normalized_email },
      attributes: {
        exclude: ['password', 'createdAt', 'updatedAt'],
        include: [
          [
            Sequelize.literal(`(
              SELECT EXISTS(
                SELECT 1 
                FROM gle_user_followers 
                WHERE follower_id = "Users"."id"
                  AND following_id = "Users"."id" 
                  AND status = 'accepted'
              )
            )`),
            'is_following',
          ],
          [
            Sequelize.literal(`(SELECT code 
              FROM gle_referral_codes 
              WHERE user_id = "Users"."id")`),
            'referral_code',
          ],
        ],
      },
      include: [
        {
          model: Device,
          as: 'device_info',
          attributes: [
            'push_status',
            'email_status',
            'device_locale',
            'device_type',
            'device_model',
            'os',
            'browser',
            'ip_address',
            'device_token',
          ],
        },
      ],
    });

    return user || null;
  }

  async update_profile(user: Users, updates: ProfileDto): Promise<string> {
    const { id: user_id, email } = user;
    const raw = { ...updates };
    if (raw.username) {
      raw.username = this.sanitize_username(raw.username) || undefined;
    }
    const exist = await this.user_repo.search_user(raw, user_id);
    await this.validate_user_existence(exist, raw);

    const payload: Partial<Users> = {
      ...(raw.full_name !== undefined && {
        full_name: raw.full_name?.trim() ?? null,
      }),
      ...(raw.bio !== undefined && { bio: raw.bio ?? null }),
      ...(raw.username !== undefined && { username: raw.username }),
      ...(raw.image !== undefined && { image: raw.image }),
      ...(raw.role !== undefined && { role: raw.role }),
      ...(user.account_status === AccountStatus.PENDING_PROFILE &&
        raw.full_name?.trim() && { account_status: AccountStatus.ACTIVE }),
    };

    if (Object.keys(payload).length > 0) {
      await this.user_repo.update_by_email(email, payload);
      this.invalidate_auth_user_cache({ email, user_id });
    }
    await this.invalidate_dashboard_cache(user_id);
    return 'Your profile has successfully been updated! 🙂';
  }

  async delete_account(user: Users): Promise<string> {
    const { id: user_id, email } = user;
    this.invalidate_auth_user_cache({ email, user_id });
    await this.invalidate_dashboard_cache(user_id);
    await this.user_repo.destroy_by_id(user_id);
    return 'Your account has been deleted successfully.';
  }

  async update_email_profile(
    user: Users,
    updates: UpdateEmailData,
  ): Promise<any> {
    const current_email = EmailUtils.normalize_email(updates.current_email);
    const new_email = EmailUtils.normalize_email(updates.new_email);
    const { id: user_id, email: user_current_email } = user;
    const normalized_user_current_email =
      EmailUtils.normalize_email(user_current_email);

    if (current_email !== normalized_user_current_email) {
      throw new HttpException(
        'Current email does not match your account email.',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    const existing_user = await this.user_repo.find_one_by_email(new_email);
    if (existing_user && existing_user.id !== user_id) {
      throw new HttpException(
        'This email is already registered by another user.',
        HttpStatus.PRECONDITION_FAILED,
      );
    }

    await this.user_repo.update_by_email(normalized_user_current_email, {
      email: new_email,
    });

    this.invalidate_auth_user_cache({
      email: new_email,
      previous_email: normalized_user_current_email,
      user_id,
    });

    const updated_user = await this.find_by_id(user_id);

    return this.auth_service.format_auth_response(
      updated_user,
      'Your email has been successfully updated! 🙂',
      false,
    );
  }

  async search_users(
    find_opts: FindDataRequestDto,
    filter_options: SearchFilterOptions,
  ): Promise<PaginationData> {
    const query = search_filter(find_opts, filter_options);

    const users = await this.user_repo.find_all_records(query);

    return {
      ...users,
      records: users.records,
    };
  }

  private async require_user_by_id(user_id: string): Promise<Users> {
    const target = await this.find_by_id(user_id);
    if (!target) {
      throw new HttpException('User not found', HttpStatus.PRECONDITION_FAILED);
    }
    return target;
  }

  private async build_user_suspension_block(user: Users): Promise<{
    suspended_at: Date | null;
    reason: string | null;
    suspended_by: {
      id: string;
      full_name: string | null;
      email: string;
      username: string;
    } | null;
  }> {
    let suspended_by: {
      id: string;
      full_name: string | null;
      email: string;
      username: string;
    } | null = null;

    if (user.suspended_by_id) {
      const actor = await this.user_repo.find_one({
        where: { id: user.suspended_by_id },
        attributes: ['id', 'full_name', 'email', 'username'],
      });
      if (actor) {
        suspended_by = {
          id: actor.id,
          full_name: actor.full_name ?? null,
          email: actor.email,
          username: actor.username,
        };
      }
    }

    return {
      suspended_at: user.suspended_at ?? null,
      reason: user.suspension_reason ?? null,
      suspended_by,
    };
  }

  async update_one_by_email(
    email: string,
    updates: Partial<Users>,
    transaction?: Transaction,
  ): Promise<[number, Users[]]> {
    try {
      const normalized_email = EmailUtils.normalize_email(email);
      const result = await this.user_repo.update_by_email(
        normalized_email,
        updates,
        transaction,
      );

      if (!transaction) {
        const new_email = updates.email
          ? EmailUtils.normalize_email(String(updates.email))
          : undefined;
        this.invalidate_auth_user_cache({
          email: new_email ?? normalized_email,
          previous_email: new_email ? normalized_email : undefined,
        });
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to update user by email ${email}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async save(
    user_data: Partial<Users>,
    transaction?: Transaction,
  ): Promise<Users> {
    return this.user_repo.save(user_data, transaction);
  }

  async set_encryption_key(user, encryption_dto) {
    this.encryption.encrypt(encryption_dto.encryption_key);
    return { service_message: 'Encryption key set successfully' };
  }

  private parse_user_agent(user_agent?: string): {
    browser?: string;
    os?: string;
    device_type?: string;
  } {
    if (!user_agent) return {};

    const ua = user_agent.toLowerCase();
    const parsed: { browser?: string; os?: string; device_type?: string } = {};

    if (ua.includes('chrome') && !ua.includes('edg')) {
      parsed.browser = 'Chrome';
    } else if (ua.includes('firefox')) {
      parsed.browser = 'Firefox';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      parsed.browser = 'Safari';
    } else if (ua.includes('edg')) {
      parsed.browser = 'Edge';
    } else if (ua.includes('opera') || ua.includes('opr')) {
      parsed.browser = 'Opera';
    }

    if (ua.includes('windows')) {
      parsed.os = 'Windows';
      parsed.device_type = 'desktop';
    } else if (ua.includes('mac os') || ua.includes('macos')) {
      parsed.os = 'macOS';
      parsed.device_type = 'desktop';
    } else if (ua.includes('linux')) {
      parsed.os = 'Linux';
      parsed.device_type = 'desktop';
    } else if (ua.includes('android')) {
      parsed.os = 'Android';
      parsed.device_type = 'mobile';
    } else if (
      ua.includes('iphone') ||
      ua.includes('ipad') ||
      ua.includes('ipod')
    ) {
      parsed.os = 'iOS';
      parsed.device_type = ua.includes('ipad') ? 'tablet' : 'mobile';
    }

    return parsed;
  }
}
