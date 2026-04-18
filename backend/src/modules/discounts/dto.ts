import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsDate, IsObject, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDiscountRuleDto {
  @IsString()
  name: string;

  @IsEnum(['REFERRAL', 'PROMO', 'MANUAL', 'SUBSCRIPTION', 'FIRST_TIME', 'FAMILY', 'LOYALTY', 'PERFORMANCE', 'VOLUME'])
  type: string;

  @IsEnum(['PERCENT', 'FIXED', 'FREE_PERIOD'])
  valueType: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isStackable?: boolean;

  @IsOptional()
  @IsEnum(['BOOKING', 'SUBSCRIPTION', 'ALL'])
  contextType?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  minPurchaseAmount?: number;

  @IsOptional()
  @IsNumber()
  maxDiscountAmount?: number;

  @IsOptional()
  @IsNumber()
  usageLimit?: number;

  @IsOptional()
  @IsNumber()
  perUserLimit?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @IsString()
  group?: string;

  @IsOptional()
  @IsObject()
  conditions?: {
    minChildren?: number;
    minMonthsActive?: number;
    medalTypes?: string[];
    programTypes?: string[];
  };
}

export class UpdateDiscountRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isStackable?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  expiresAt?: Date;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ApplyPromoCodeDto {
  @IsString()
  promoCode: string;

  @IsOptional()
  @IsString()
  childId?: string;
}

export class CalculateDiscountDto {
  @IsNumber()
  baseAmount: number;

  @IsOptional()
  @IsString()
  childId?: string;

  @IsOptional()
  @IsEnum(['BOOKING', 'SUBSCRIPTION'])
  context?: string;

  @IsOptional()
  @IsString()
  promoCode?: string;
}
