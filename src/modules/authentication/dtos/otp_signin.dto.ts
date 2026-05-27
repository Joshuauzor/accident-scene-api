import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import User from '../../users/entities/user.entity';
import { Match } from 'src/modules/users/dtos/user.dto';
import { Transform } from 'class-transformer';

export class OtpSignInDto extends User {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  password: string;
}

export class ForgotOtpDto extends User {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).{6,20}$/, {
    message:
      'Password must be 6+ characters, include uppercase, lowercase and at least a number or symbol.',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Match('password', { message: 'Passwords do not match' })
  confirm_password: string;
}

export class ResetOtpDto extends User {
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  current_password: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).{6,20}$/, {
    message:
      'Password must be 6+ characters, include uppercase, lowercase and at least a number or symbol.',
  })
  new_password: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Match('new_password', { message: 'Passwords do not match' })
  confirm_password: string;
}

export class ResendDto extends User {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
