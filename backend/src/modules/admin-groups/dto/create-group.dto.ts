import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ScheduleItemDto {
  @IsString()
  day: string;

  @IsString()
  time: string;
}

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsString()
  clubId: string;

  @IsString()
  coachId: string;

  @IsEnum(['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'])
  programType: string;

  @IsOptional()
  @IsString()
  ageRange?: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsString()
  locationId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  @ArrayMinSize(1)
  schedule: ScheduleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  monthlyTrainingsTarget?: number;

  @IsInt()
  @Min(0)
  monthlyPrice: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
