import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyGoogleIdTokenDto {
  @IsString()
  @IsNotEmpty()
  id_token: string;
}

export class VerifyAppleIdTokenDto {
  @IsString()
  @IsNotEmpty()
  id_token: string;

  @IsString()
  @IsOptional()
  user_identifier?: string;
}
