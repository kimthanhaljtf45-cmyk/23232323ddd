import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum, Min, Max } from 'class-validator';
import { ProgramType } from '../../domain/enums';

export class CreateProgramDto {
  @IsString()
  name: string;

  @IsEnum(['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'])
  type: ProgramType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(7)
  trainingsPerWeek?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  duration?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStudents?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  coachIds?: string[];

  @IsString()
  clubId: string;

  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  level?: string;

  @IsOptional()
  @IsNumber()
  ageFrom?: number;

  @IsOptional()
  @IsNumber()
  ageTo?: number;
}

export class UpdateProgramDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  trainingsPerWeek?: number;

  @IsOptional()
  @IsNumber()
  duration?: number;

  @IsOptional()
  @IsNumber()
  maxStudents?: number;

  @IsOptional()
  @IsArray()
  coachIds?: string[];

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsNumber()
  ageFrom?: number;

  @IsOptional()
  @IsNumber()
  ageTo?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignCoachDto {
  @IsString()
  coachId: string;
}
