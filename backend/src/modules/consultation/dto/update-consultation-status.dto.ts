import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateConsultationStatusDto {
  @IsIn(['NEW', 'CONTACTED', 'BOOKED_TRIAL', 'TRIAL_DONE', 'CONVERTED', 'LOST'])
  status: 'NEW' | 'CONTACTED' | 'BOOKED_TRIAL' | 'TRIAL_DONE' | 'CONVERTED' | 'LOST';

  @IsOptional()
  @IsString()
  lostReason?: string;

  @IsOptional()
  @IsString()
  trialDate?: string;

  @IsOptional()
  @IsString()
  trialLocationId?: string;
}
