import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateCompetitionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsEnum(['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'])
  programType?:
    | 'KIDS'
    | 'SPECIAL'
    | 'SELF_DEFENSE'
    | 'MENTORSHIP'
    | 'CONSULTATION';

  @IsOptional()
  @IsString()
  registrationDeadline?: string;

  @IsOptional()
  @IsBoolean()
  hasFee?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeAmount?: number;

  @IsOptional()
  @IsEnum(['DRAFT', 'OPEN', 'CLOSED', 'FINISHED'])
  status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINISHED';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
