import { IsArray, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateConsultationDto {
  @IsString()
  fullName: string;

  @IsOptional()
  @IsString()
  childName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsString()
  phone: string;

  @IsOptional()
  @IsIn(['PARENT', 'STUDENT'])
  role?: 'PARENT' | 'STUDENT';

  @IsOptional()
  @IsIn([
    'KIDS',
    'SPECIAL',
    'ADULT_SELF_DEFENSE',
    'ADULT_PRIVATE',
    'CONSULTATION',
  ])
  programType?:
    | 'KIDS'
    | 'SPECIAL'
    | 'ADULT_SELF_DEFENSE'
    | 'ADULT_PRIVATE'
    | 'CONSULTATION';

  @IsOptional()
  @IsString()
  childAge?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsArray()
  preferredDays?: string[];

  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
