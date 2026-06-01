export enum UserRole {
  ADMIN = 'admin',
  AGENT = 'agent',
}

export enum AccountStatus {
  ACTIVE = 'active',
  PENDING_VERIFICATION = 'pending_verification',
  PENDING_PROFILE = 'pending_profile',
  SUSPENDED = 'suspended',
  DEACTIVATED = 'deactivated',
}

export enum InterventionType {
  MEDICAL = 'medical',
  FIRE = 'fire',
  TRAFFIC = 'traffic',
  STRUCTURAL = 'structural',
  OTHER = 'other',
}
