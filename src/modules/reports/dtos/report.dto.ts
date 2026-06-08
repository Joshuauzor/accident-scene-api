import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { InterventionType } from 'src/shared/enums/roles';

export class ReportStepOneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  last_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  location: string;
}

export class ReportStepTwoDto {
  @IsEnum(InterventionType)
  @IsNotEmpty()
  intervention_type: InterventionType;
}
