import { IsString } from 'class-validator';

export class AssignCoachDto {
  @IsString()
  coachId: string;
}
