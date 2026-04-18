import { IsString, IsOptional } from 'class-validator';

export class MockAuthDto {
  @IsString()
  telegramId: string;

  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  username?: string;
}
