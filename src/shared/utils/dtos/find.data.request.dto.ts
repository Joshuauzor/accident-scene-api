import { IsOptional, IsString, IsNumberString } from 'class-validator';

export class FindDataRequestDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  search_param?: string;

  @IsOptional()
  year?: string;

  @IsOptional()
  type?: string;

  @IsOptional()
  param?: string;

  @IsOptional()
  value?: string;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;

  @IsOptional()
  @IsNumberString()
  skip? = '0';

  @IsOptional()
  @IsNumberString()
  take? = '10';

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsOptional()
  @IsString()
  search_by?: string;

  @IsOptional()
  usepaginate?: 'false' | 'true' = 'true';

  @IsOptional()
  date?: string;

  @IsOptional()
  @IsString()
  user_id?: string;

  @IsOptional()
  @IsString()
  start_date?: string;

  @IsOptional()
  @IsString()
  end_date?: string;

  @IsOptional()
  @IsString()
  group_by?: string;

  @IsOptional()
  @IsString()
  place_id?: string;

  @IsOptional()
  @IsString()
  id?: string;
}
