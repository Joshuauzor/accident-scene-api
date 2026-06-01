import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { UserService } from '../services/user.service';
import { GET_CURRENT_USER } from 'src/shared/decorators/get_current_user';
import Users from 'src/modules/users/entities/user.entity';
import { ProfileDto, UpdatePhoneDto } from 'src/modules/users/dtos/user.dto';
import { SearchFilterOptions } from 'src/shared/types/types';
import { FindDataRequestDto } from 'src/shared/utils/dtos/find.data.request.dto';

@Controller('users')
export class UserController {
  constructor(private user_service: UserService) {}

  @Get('x-user/:email') // For in app use only!
  get_x_user_by_email(
    @Param('email') email: string,
    @Req() { headers }: Request,
  ) {
    const authorization = headers.authorization;
    if (authorization !== '%x-user/:email%') {
      throw new HttpException('Please provide token', HttpStatus.UNAUTHORIZED);
    }
    return this.user_service.user_check(email);
  }

  @Patch('profile')
  update_user_profile(
    @GET_CURRENT_USER() user: Users,
    @Body() payload: ProfileDto,
  ) {
    return this.user_service.update_profile(user, payload);
  }

  @Get('search')
  search_users(@Query() find_opts: FindDataRequestDto) {
    const filter_options: SearchFilterOptions = {
      allowed_fields: ['email', 'username', 'full_name', 'phone_number'],
      search_fields: ['email', 'username', 'full_name', 'phone_number'],
    };
    return this.user_service.search_users(find_opts, filter_options);
  }

  @Get('current-user')
  get_user_info(@GET_CURRENT_USER() user: Users, @Query() find_opts) {
    return this.user_service.user_dashboard(user, find_opts);
  }

  @Delete('account')
  delete_account(@GET_CURRENT_USER() user: Users) {
    return this.user_service.delete_account(user);
  }
}
