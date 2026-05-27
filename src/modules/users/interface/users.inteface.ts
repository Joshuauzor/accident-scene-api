import { AccountStatus, Roles } from 'src/shared/enums/roles';

export class UsersDto {
  email: string;
  full_name: string;
  username?: string;
  image?: string;
  is_active?: boolean;
  account_status?: AccountStatus;
  phone_number?: string;
  oauth_provider?: string;
  provider_id?: string;
  password?: string;
  confirm_password?: string;
  role?: Roles;
}

export class UpdateEmailData {
  current_email: string;
  new_email: string;
  confirm_email: string;
}
