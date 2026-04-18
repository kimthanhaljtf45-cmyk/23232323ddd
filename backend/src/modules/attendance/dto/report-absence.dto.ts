import { IsString, IsOptional } from 'class-validator';

export class ReportAbsenceDto {
  @IsString()
  childId: string;

  @IsString()
  scheduleId: string;

  @IsString()
  date: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
