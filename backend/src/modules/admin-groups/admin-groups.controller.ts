import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminGroupsService } from './admin-groups.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import {
  CreateGroupDto,
  UpdateGroupDto,
  AssignCoachDto,
  AssignStudentsDto,
  MoveStudentDto,
} from './dto';

@Controller('admin/groups')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminGroupsController {
  constructor(private readonly adminGroupsService: AdminGroupsService) {}

  @Post()
  create(@Body() dto: CreateGroupDto): Promise<any> {
    return this.adminGroupsService.create(dto);
  }

  @Get()
  findAll(
    @Query('clubId') clubId?: string,
    @Query('coachId') coachId?: string,
    @Query('isActive') isActive?: string,
  ): Promise<any[]> {
    return this.adminGroupsService.findAll({ clubId, coachId, isActive });
  }

  @Get(':id')
  findById(@Param('id') id: string): Promise<any> {
    return this.adminGroupsService.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto): Promise<any> {
    return this.adminGroupsService.update(id, dto);
  }

  @Post(':id/assign-coach')
  assignCoach(@Param('id') id: string, @Body() dto: AssignCoachDto): Promise<any> {
    return this.adminGroupsService.assignCoach(id, dto);
  }

  @Post(':id/assign-students')
  assignStudents(@Param('id') id: string, @Body() dto: AssignStudentsDto): Promise<any> {
    return this.adminGroupsService.assignStudents(id, dto);
  }

  @Delete(':id/students/:childId')
  removeStudent(
    @Param('id') groupId: string,
    @Param('childId') childId: string,
  ) {
    return this.adminGroupsService.removeStudentFromGroup(groupId, childId);
  }

  @Post(':id/move-student')
  moveStudent(
    @Param('id') groupId: string,
    @Body() dto: MoveStudentDto,
  ) {
    return this.adminGroupsService.moveStudent(dto.studentId, dto.targetGroupId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.adminGroupsService.remove(id);
  }
}
