import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  date: string;

  @IsString()
  location: string;

  @IsEnum(['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'])
  programType:
    | 'KIDS'
    | 'SPECIAL'
    | 'SELF_DEFENSE'
    | 'MENTORSHIP'
    | 'CONSULTATION';

  @IsString()
  registrationDeadline: string;

  @IsBoolean()
  hasFee: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  feeAmount?: number;

  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
