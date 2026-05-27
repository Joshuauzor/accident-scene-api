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
  private readonly action_routes_to_ignore = [
    '/api/v1/auth',
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/send-otp',
    '/api/v1/auth/verify-otp',
    '/api/v1/oauth/google',
    '/api/v1/oauth/google/verify',
    '/api/v1/oauth/google/client-id',
    '/api/v1/oauth/apple',
    '/api/v1/oauth/apple/verify',
    '/api/v1/oauth/apple/client-id',
    '/api/v1/oauth/google-callback',
    '/api/v1/oauth/apple-callback',
    '/api/v1/auth/forgot-password',
    '/api/v1/settings/app-config',
    '/api/v1/waitlist',
    '/api/v1/events/banners',
    '/api/v1/events/list',
    '/api/v1/interest/list',
    '/api/v1/events/discount-code/validate',
    '/api/v1/settings/location/region',
    '/api/v1/settings/location/places/autocomplete',
    '/api/v1/settings/location/places/details',
    '/api/v1/events/purchase-ticket/guest',
    '/api/v1/transactions/validate',
    '/api/v1/transactions/webhook/monnify/funding',
    '/api/v1/transactions/withdrawal/validate-otp',
  ];

  private readonly public_route_patterns = [
    /^\/api\/v1\/events\/(?:details|tickets-by-event)\/[^/]+$/i,
    /^\/api\/v1\/events\/get-tickets-as-attendee-per-event\/public\/[^/]+$/i,
  ];

  constructor(
    private readonly reflector: Reflector,
    private readonly authenticated_user_service: AuthenticatedUserService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/naming-convention
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

    const normalized_path =
      request.originalUrl?.split('?')[0].replace(/\/+$/, '') || '';

    const matches_public_pattern = this.public_route_patterns.some((pattern) =>
      pattern.test(normalized_path),
    );

    const allowed =
      is_public ||
      this.action_routes_to_ignore.includes(normalized_path) ||
      matches_public_pattern;

    const authorization = request.headers.authorization;

    if (authorization?.includes('Bearer ')) {
      request.current_user =
        await this.authenticated_user_service.resolve_from_authorization(
          authorization,
        );
    } else if (request.headers['x-api-key']) {
      // const app = await this.verifyAppKey(request);
      // request.currentApp = app;
      // request.current_user = app.user;
    } else if (allowed) {
      (request as any).action_guard_passed = true;
      return true;
    } else {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
