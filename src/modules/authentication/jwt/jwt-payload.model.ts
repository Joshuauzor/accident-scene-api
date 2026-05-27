export interface TokenUserClaims {
  id: string;
  email: string;
}

export interface JwtPayload {
  user: TokenUserClaims;
  iat?: Date;
}
