import * as bcrypt from 'bcrypt';
import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { EmailUtils } from 'src/shared/utils/email.utils';
import { UserRepository } from '../repositories/user.repository';
import Users from '../entities/user.entity';
import { AuthService } from 'src/modules/authentication/services/auth.service';
import { Transaction } from 'sequelize';
import { CreateUserInput } from '../interface/users.inteface';
import {
  AuthUserCacheInvalidateOptions,
  AuthUserCacheService,
} from 'src/global/services/cache/auth-user-cache.service';

@Injectable()
export class UserService {
  constructor(
    private readonly user_repo: UserRepository,
    @Inject(forwardRef(() => AuthService))
    private readonly auth_service: AuthService,
    private readonly auth_user_cache: AuthUserCacheService,
  ) {}

  private invalidate_auth_user_cache(
    options: AuthUserCacheInvalidateOptions,
  ): void {
    void this.auth_user_cache.invalidate(options);
  }

  private async hash_password(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }

  async create_user(
    user_dto: CreateUserInput,
    transaction?: Transaction,
  ): Promise<Omit<Users, 'password'>> {
    try {
      const normalized_email = EmailUtils.normalize_email(user_dto.email);
      const exist = await this.user_repo.find_by_email(
        normalized_email,
        transaction,
      );

      if (exist) {
        throw new HttpException(
          'Email already in use.',
          HttpStatus.PRECONDITION_FAILED,
        );
      }

      const hashed_password = await this.hash_password(user_dto.password);

      const create_payload: Partial<Users> = {
        email: normalized_email,
        password: hashed_password,
        tenant_id: user_dto.tenant_id,
        role: user_dto.role,
      };

      return this.save(create_payload, transaction);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error.message || 'Registration failed.',
        HttpStatus.BAD_REQUEST,
      );
    }
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

  find_by_id(id: string, transaction?: Transaction) {
    return this.find_one(
      {
        where: { id },
        attributes: { exclude: ['password'] },
      },
      transaction,
    );
  }

  async user_dashboard(user: Users) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id,
    };
  }

  async delete_account(user: Users): Promise<string> {
    const { id: user_id, email } = user;
    this.invalidate_auth_user_cache({ email, user_id });
    await this.user_repo.destroy_by_id(user_id);
    return 'Account deleted.';
  }

  async update_one_by_email(
    email: string,
    updates: Partial<Users>,
    transaction?: Transaction,
  ): Promise<[number, Users[]]> {
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
  }

  async save(
    user_data: Partial<Users>,
    transaction?: Transaction,
  ): Promise<Users> {
    return this.user_repo.save(user_data, transaction);
  }
}
