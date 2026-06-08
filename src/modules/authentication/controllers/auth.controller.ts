import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { UserDto } from '../../users/dtos/user.dto';
import { SignInDto } from '../dtos/otp_signin.dto';

@Controller('auth')
export class AuthController {
  constructor(private auth_service: AuthService) {}

  private get_client_ip(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  @Post('register')
  register(@Body() new_user: UserDto) {
    return this.auth_service.register(new_user);
  }

  @Post('login')
  login(@Body() payload: SignInDto, @Req() req: Request) {
    return this.auth_service.login(payload, this.get_client_ip(req));
  }
}
