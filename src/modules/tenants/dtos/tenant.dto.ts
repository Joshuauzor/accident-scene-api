import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  slug: string;
}
