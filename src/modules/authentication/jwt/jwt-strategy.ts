import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt, VerifiedCallback } from 'passport-jwt';
import { JwtPayload } from './jwt-payload.model';
import { Injectable } from '@nestjs/common';
import { AuthenticatedUserService } from '../services/authenticated-user.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authenticated_user_service: AuthenticatedUserService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: 'jwtConstants.secret',
    });
  }

  async validate(payload: JwtPayload, done: VerifiedCallback) {
    try {
      const user = await this.authenticated_user_service.resolve_by_email(
        payload.user.email,
      );
      return done(null, user, payload.iat);
    } catch (error) {
      return done(error, false);
    }
  }
}
