import { IsString, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  coachId: string;

  @IsString()
  slotId: string;

  @IsEnum(['PERSONAL', 'TRIAL', 'CONSULTATION'])
  type: string;

  @IsOptional()
  @IsString()
  childId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateBookingStatusDto {
  @IsEnum(['PENDING', 'CONFIRMED', 'CANCELLED', 'DONE', 'NO_SHOW'])
  status: string;

  @IsOptional()
  @IsString()
  cancelReason?: string;
}

export class CreateAvailabilityDto {
  @IsString()
  clubId: string;

  @IsString()
  coachId: string;

  @IsNumber()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  @IsString()
  startTime: string; // "09:00"

  @IsString()
  endTime: string; // "18:00"
}

export class GenerateSlotsDto {
  @IsString()
  coachId: string;

  @IsString()
  clubId: string;

  @IsString()
  startDate: string; // YYYY-MM-DD

  @IsString()
  endDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsNumber()
  slotDuration?: number; // хвилини, default 60

  @IsOptional()
  @IsEnum(['PERSONAL', 'TRIAL', 'CONSULTATION'])
  type?: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
