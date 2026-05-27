import { Request } from 'express';
import Admin from 'src/modules/admin/admin.entity';
import User from 'src/modules/users/entities/user.entity';

export type CurrentUser = Request & { current_user: User };
export type CurrentAdmin = Request & {
  admin: Admin;
  current_user: User;
};
