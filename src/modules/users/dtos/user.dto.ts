/* eslint-disable @typescript-eslint/naming-convention */
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import User from '../entities/user.entity';
import { Roles } from 'src/shared/enums/roles';
import { Transform } from 'class-transformer';

export function Match(
  property: string,
  validation_options?: ValidationOptions,
) {
  return function (object: Object, property_name: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: property_name,
      options: validation_options,
      constraints: [property],
      validator: MatchPasswordsConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'MatchPasswordsConstraint', async: false })
export class MatchPasswordsConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const [related_property_name] = args.constraints;
    const related_value = (args.object as any)[related_property_name];
    return value === related_value;
  }

  defaultMessage(args: ValidationArguments) {
    const [related_property_name] = args.constraints;
    return `${args.property} must match ${related_property_name}`;
  }
}

export class UserEncryptionDto {
  @IsString()
  @IsNotEmpty()
  encryptionKey: string;
}

export class UsernameDto extends User {
  @IsString()
  @IsNotEmpty()
  declare username: string;
}

export class UserDto extends User {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  declare email: string;

  @IsString()
  @IsOptional()
  declare full_name: string;

  @IsOptional()
  @IsString()
  declare username: string;

  @IsString()
  @IsOptional()
  declare image: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).{6,20}$/, {
    message:
      'Password must be 6+ characters, include uppercase, lowercase and at least a number or symbol.',
  })
  declare password: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Match('password', { message: 'Passwords do not match' })
  declare confirm_password: string;

  @IsString()
  @IsOptional()
  referral_code?: string;

  @IsEnum(Roles)
  @IsOptional()
  declare role: Roles;
}

export class ProfileDto {
  @IsOptional()
  @IsString()
  full_name?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsEnum(Roles)
  role?: Roles;
}

export class UpdateEmailDto extends User {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Please enter a valid current email address' })
  current_email: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'Please enter a valid new email address' })
  new_email: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Match('new_email', { message: 'Email addresses do not match' })
  confirm_email: string;
}

export class UpdatePhoneDto extends User {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\+?[\d\s\-()]{10,}$/, {
    message: 'Please enter a valid current phone number',
  })
  current_phone: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^\+?[\d\s\-()]{10,}$/, {
    message: 'Please enter a valid new phone number',
  })
  new_phone: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Match('new_phone', { message: 'Phone numbers do not match' })
  confirm_phone: string;
}

export class SuspendUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
