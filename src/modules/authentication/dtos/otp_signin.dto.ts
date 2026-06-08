import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import User from '../../users/entities/user.entity';
import { Transform } from 'class-transformer';

export class SignInDto extends User {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  declare email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  declare password: string;
}
