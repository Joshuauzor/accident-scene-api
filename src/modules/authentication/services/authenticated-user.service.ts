import {
  forwardRef,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { UserService } from 'src/modules/users/services/user.service';
import Users from 'src/modules/users/entities/user.entity';
import { AccessTokenService } from './access-token.service';

@Injectable()
export class AuthenticatedUserService {
  constructor(
    private readonly access_token_service: AccessTokenService,
    @Inject(forwardRef(() => UserService))
    private readonly user_service: UserService,
  ) {}

  async resolve_from_authorization(authorization: string): Promise<Users> {
    const email =
      this.access_token_service.parse_email_from_authorization(authorization);
    return this.resolve_by_email(email);
  }

  async resolve_from_access_token(token: string): Promise<Users> {
    if (!token?.trim()) {
      throw new HttpException('Please provide token', HttpStatus.BAD_REQUEST);
    }

    const email =
      this.access_token_service.parse_email_from_access_token(token);
    return this.resolve_by_email(email);
  }

  async resolve_by_email(email: string): Promise<Users> {
    const user = await this.user_service.find_by_email_for_auth(email);

    if (!user) {
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }

    return this.to_safe_user(user);
  }

  private to_safe_user(user: Users): Users {
    const plain = (user as any)?.get?.({ plain: true }) ?? user;
    const { password: _password, ...safe_user } = plain as Users;
    return safe_user as Users;
  }
}
