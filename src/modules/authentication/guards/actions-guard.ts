import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from 'src/shared/decorators/get_current_user';
import Users from 'src/modules/users/entities/user.entity';
import { AuthenticatedUserService } from '../services/authenticated-user.service';

@Injectable()
export class ActionsGuard implements CanActivate {
  private readonly public_routes = [
    '/api/v1/bootstrap/status',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
  ];

  constructor(
    private readonly reflector: Reflector,
    private readonly authenticated_user_service: AuthenticatedUserService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const request: Request & { current_user: Users } = ctx
      .switchToHttp()
      .getRequest();

    (request as any).action_guard_passed = false;
    if (!(request as any)?.rateLimitPassed) {
      return true;
    }

    const is_public = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const path = request.originalUrl?.split('?')[0].replace(/\/+$/, '') || '';
    const allowed = is_public || this.public_routes.includes(path);

    const authorization = request.headers.authorization;

    if (authorization?.includes('Bearer ')) {
      request.current_user =
        await this.authenticated_user_service.resolve_from_authorization(
          authorization,
        );
    } else if (allowed) {
      (request as any).action_guard_passed = true;
      return true;
    } else {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
