import { IsString } from 'class-validator';

export class MoveStudentDto {
  @IsString()
  studentId: string;

  @IsString()
  targetGroupId: string;
}
