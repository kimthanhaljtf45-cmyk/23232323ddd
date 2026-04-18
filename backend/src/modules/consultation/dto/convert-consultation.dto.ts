import { IsOptional, IsString } from 'class-validator';

export class ConvertConsultationDto {
  @IsOptional()
  @IsString()
  locationId?: string;

  @IsOptional()
  @IsString()
  groupId?: string;
}
