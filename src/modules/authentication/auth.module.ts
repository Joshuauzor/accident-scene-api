import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from './services/auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt/jwt-strategy';
import { configs } from '../../../config/config.env';
import { UserModule } from '../users/user.module';
import { OAuthController } from './controllers/oauth.controller';
import { OAuthService } from './services/oauth.service';
import { AccessCodeModule } from '../accesscode/accesscode.module';
import { OtpVerifiedGuard } from './guards/otp-verified.guard';
import { ActionsGuard } from './guards/actions-guard';
import { AccessTokenService } from './services/access-token.service';
import { AuthenticatedUserService } from './services/authenticated-user.service';
import { EventModule } from '../events/event.module';
import { MarketPlaceModule } from '../marketplace/marketplace.module';

@Module({
  controllers: [AuthController, OAuthController],
  providers: [
    AccessTokenService,
    AuthenticatedUserService,
    JwtService,
    JwtStrategy,
    AuthService,
    OAuthService,
    OtpVerifiedGuard,
    ActionsGuard,
    {
      provide: APP_GUARD,
      useClass: ActionsGuard,
    },
  ],
  exports: [
    AccessTokenService,
    AuthenticatedUserService,
    JwtService,
    JwtStrategy,
    AuthService,
    OAuthService,
    OtpVerifiedGuard,
    ActionsGuard,
  ],
  imports: [
    PassportModule,
    JwtModule.register({
      secret: configs.JWT_SECRET,
      signOptions: { expiresIn: '60s' },
    }),
    AccessCodeModule,
    forwardRef(() => UserModule),
    forwardRef(() => EventModule),
    forwardRef(() => MarketPlaceModule),
  ],
})
export class AuthModule {}
