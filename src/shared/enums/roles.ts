export enum Roles {
  USER = 'user',
}

export enum AdminRoles {
  ADMIN = 'Admin',
  USER = 'User',
  SUPER_ADMIN = 'Superadmin',
}

export enum AccountType {
  REGULAR = 'regular',
  CREATOR = 'creator',
}

export enum AccountStatus {
  ACTIVE = 'active',
  PENDING_VERIFICATION = 'pending_verification',
  PENDING_PROFILE = 'pending_profile',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}
