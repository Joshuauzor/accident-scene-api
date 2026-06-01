import { UserRole } from 'src/shared/enums/roles';

export class CreateUserInput {
  email: string;
  full_name: string;
  password: string;
  role?: UserRole;
}

export class UpdateEmailData {
  current_email: string;
  new_email: string;
  confirm_email: string;
}
