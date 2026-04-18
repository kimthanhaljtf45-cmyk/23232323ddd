import { IsOptional, IsString } from 'class-validator';

export class AssignConsultationDto {
  @IsOptional()
  @IsString()
  assignedToAdminId?: string;

  @IsOptional()
  @IsString()
  assignedCoachId?: string;
}
