import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/roles';
import Users from 'src/modules/users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required_roles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required_roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: Users = request.current_user;

    if (!user || !required_roles.includes(user.role as UserRole)) {
      throw new HttpException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
