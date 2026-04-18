import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateResultDto {
  @IsString()
  childId: string;

  @IsEnum(['GOLD', 'SILVER', 'BRONZE', 'PARTICIPATION'])
  medal: 'GOLD' | 'SILVER' | 'BRONZE' | 'PARTICIPATION';

  @IsInt()
  @Min(1)
  place: number;

  @IsOptional()
  @IsString()
  awardType?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
