import { IsOptional, IsString } from 'class-validator';

export class JoinCompetitionDto {
  @IsString()
  childId: string;

  @IsOptional()
  @IsString()
  category?: string;
}
