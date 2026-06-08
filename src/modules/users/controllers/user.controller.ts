import { Controller, Delete, Get } from '@nestjs/common';
import { UserService } from '../services/user.service';
import { GET_CURRENT_USER } from 'src/shared/decorators/get_current_user';
import Users from 'src/modules/users/entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private user_service: UserService) {}

  @Get('current-user')
  get_user_info(@GET_CURRENT_USER() user: Users) {
    return this.user_service.user_dashboard(user);
  }

  @Delete('account')
  delete_account(@GET_CURRENT_USER() user: Users) {
    return this.user_service.delete_account(user);
  }
}
