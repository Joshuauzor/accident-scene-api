/* eslint-disable @typescript-eslint/naming-convention */
import {
  IsEmail,
  IsNotEmpty,
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
import { Transform } from 'class-transformer';

export function Match(
  property: string,
  validation_options?: ValidationOptions,
) {
  return function (object: any, property_name: string) {
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

export class UserDto extends User {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @IsNotEmpty()
  declare email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  tenant_slug: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(20)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W_]).{6,20}$/)
  declare password: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Match('password')
  declare confirm_password: string;
}
