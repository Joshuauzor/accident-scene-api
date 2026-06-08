import { forwardRef, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { UserModule } from '../users/user.module';
import { TenantModule } from '../tenants/tenant.module';
import { ActionsGuard } from './guards/actions-guard';
import { AccessTokenService } from './services/access-token.service';
import { AuthenticatedUserService } from './services/authenticated-user.service';

@Module({
  controllers: [AuthController],
  providers: [
    AccessTokenService,
    AuthenticatedUserService,
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
    AuthService,
    ActionsGuard,
  ],
  imports: [forwardRef(() => UserModule), TenantModule],
})
export class AuthModule {}
