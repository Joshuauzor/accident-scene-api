import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from './services/auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt/jwt-strategy';
import { configs } from '../../../config/config.env';
import { UserModule } from '../users/user.module';
import { ActionsGuard } from './guards/actions-guard';
import { AccessTokenService } from './services/access-token.service';
import { AuthenticatedUserService } from './services/authenticated-user.service';

@Module({
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    AuthenticatedUserService,
    JwtService,
    JwtStrategy,
    AuthService,
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
    ActionsGuard,
  ],
  imports: [
    PassportModule,
    JwtModule.register({
      secret: configs.JWT_SECRET,
      signOptions: { expiresIn: '60s' },
    }),
    forwardRef(() => UserModule),
  ],
})
export class AuthModule {}
