import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../services/auth.service';
import { GET_CURRENT_USER } from 'src/shared/decorators/get_current_user';
import { UserDto, UsernameDto } from '../../users/dtos/user.dto';
import { GenTokenDto } from '../dtos/generate_token.dto';
import {
  ForgotOtpDto,
  OtpSignInDto,
  ResendDto,
  ResetOtpDto,
} from '../dtos/otp_signin.dto';
import { VerifyOtpDto } from '../dtos/veriy_otp.dto';
import Users from 'src/modules/users/entities/user.entity';

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
  add_user(@Body() new_user: UserDto) {
    return this.auth_service.register(new_user);
  }

  @Post('username-check')
  username_check(
    @GET_CURRENT_USER() user: Users,
    @Body() user_check: UsernameDto,
  ) {
    return this.auth_service.username_check(user, user_check);
  }

  @Post()
  sign_token(@Body() payload: GenTokenDto) {
    return this.auth_service.generate_access_token(payload);
  }

  @Get('user-x-token/:token')
  get_user_by_signed_token(@Param('token') token: string) {
    return this.auth_service.get_user_by_signed_token(token);
  }

  @Post('login')
  request_user_otp(@Body() payload: OtpSignInDto, @Req() req: Request) {
    return this.auth_service.login(payload, this.get_client_ip(req));
  }

  // @Post('forgot-password')
  // @UseGuards(OtpVerifiedGuard)
  // forgot_password(@Body() payload: ForgotOtpDto, @Req() req: Request) {
  //   return this.auth_service.forgot_password(payload, this.get_client_ip(req));
  // }

  @Post('reset-password')
  reset_password(
    @GET_CURRENT_USER() user: Users,
    @Body() payload: ResetOtpDto,
  ) {
    return this.auth_service.reset_password(user, payload);
  }

  @Post('send-otp')
  send_otp(@Body() payload: ResendDto, @Req() req: Request) {
    return this.auth_service.send_otp(payload, this.get_client_ip(req));
  }

  @Post('verify-otp')
  verify_otp(@Body() payload: VerifyOtpDto) {
    return this.auth_service.verify_otp(payload);
  }
}
