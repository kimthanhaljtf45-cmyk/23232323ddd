import { IsString, IsIn, IsOptional } from 'class-validator';

export class MarkAttendanceDto {
  @IsString()
  childId: string;

  @IsString()
  scheduleId: string;

  @IsString()
  date: string;

  @IsIn(['PRESENT', 'ABSENT', 'WARNED', 'LATE'])
  status: 'PRESENT' | 'ABSENT' | 'WARNED' | 'LATE';

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  comment?: string;
}
