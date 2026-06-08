import { UserRole } from 'src/shared/enums/roles';

export interface CreateUserInput {
  email: string;
  password: string;
  tenant_id: string;
  role?: UserRole;
}
