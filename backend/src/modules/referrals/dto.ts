import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreateReferralDto {
  @IsOptional()
  @IsString()
  invitedPhone?: string;
}

export class ApplyReferralCodeDto {
  @IsString()
  referralCode: string;
}

export class UpdateReferralStatusDto {
  @IsEnum(['PENDING', 'REGISTERED', 'CONFIRMED', 'REWARDED'])
  status: string;
}
