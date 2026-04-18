import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class AssignStudentsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  childIds: string[];
}
