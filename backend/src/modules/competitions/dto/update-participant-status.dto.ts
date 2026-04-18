import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateParticipantStatusDto {
  @IsString()
  participantId: string;

  @IsEnum(['PENDING', 'CONFIRMED', 'REJECTED'])
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED';

  @IsOptional()
  @IsString()
  note?: string;
}
