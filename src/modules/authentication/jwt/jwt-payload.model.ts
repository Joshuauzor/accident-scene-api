export interface TokenUserClaims {
  id: string;
  email: string;
  tenant_id?: string;
  role?: string;
}

export interface JwtPayload {
  user: TokenUserClaims;
  iat?: Date;
}
