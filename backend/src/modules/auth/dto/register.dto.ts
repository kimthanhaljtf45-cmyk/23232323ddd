import { IsString, IsOptional, IsIn } from 'class-validator';

export class RegisterDto {
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

  @IsIn(['STUDENT', 'PARENT'])
  role: 'STUDENT' | 'PARENT';
}

export class SelectRoleDto {
  @IsIn(['STUDENT', 'PARENT'])
  role: 'STUDENT' | 'PARENT';
}

export class CoachInviteDto {
  @IsString()
  inviteCode: string;
}
