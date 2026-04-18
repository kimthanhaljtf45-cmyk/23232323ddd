import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateCoachProfileDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clubIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialization?: string[];

  @IsOptional()
  @IsString()
  bio?: string;
}

export class UpdateCoachProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  clubIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialization?: string[];

  @IsOptional()
  @IsString()
  bio?: string;
}
