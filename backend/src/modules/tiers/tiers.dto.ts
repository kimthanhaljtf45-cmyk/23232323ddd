import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum, Min } from 'class-validator';

export class CreateTierDto {
  @IsString()
  clubId: string;

  @IsEnum(['BASE', 'PRO', 'VIP'])
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  trainingsPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  includesPersonal?: boolean;

  @IsOptional()
  @IsNumber()
  freePersonalSessions?: number;

  @IsOptional()
  @IsBoolean()
  includesCompetitions?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @IsOptional()
  @IsNumber()
  personalDiscount?: number;

  @IsOptional()
  @IsNumber()
  discountMultiplier?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  benefits?: string[];
}

export class UpdateTierDto {
  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  trainingsPerWeek?: number;

  @IsOptional()
  @IsBoolean()
  includesPersonal?: boolean;

  @IsOptional()
  @IsNumber()
  freePersonalSessions?: number;

  @IsOptional()
  @IsBoolean()
  includesCompetitions?: boolean;

  @IsOptional()
  @IsBoolean()
  prioritySupport?: boolean;

  @IsOptional()
  @IsNumber()
  personalDiscount?: number;

  @IsOptional()
  @IsNumber()
  discountMultiplier?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  benefits?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
