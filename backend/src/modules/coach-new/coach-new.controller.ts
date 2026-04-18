import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CoachNewService } from './coach-new.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { CreateCoachProfileDto, UpdateCoachProfileDto } from './dto';

@Controller('coach')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CoachNewController {
  constructor(private readonly coachService: CoachNewService) {}

  // Admin endpoints for managing coach profiles
  @Post('profiles')
  @Roles('ADMIN')
  createProfile(@Body() dto: CreateCoachProfileDto) {
    return this.coachService.createProfile(dto);
  }

  @Patch('profiles/:userId')
  @Roles('ADMIN')
  updateProfile(
    @Param('userId') userId: string,
    @Body() dto: UpdateCoachProfileDto,
  ) {
    return this.coachService.updateProfile(userId, dto);
  }

  // Coach's own endpoints
  @Get('profile')
  @Roles('COACH')
  getMyProfile(@CurrentUser() user: any) {
    return this.coachService.getProfile(user.id);
  }

  @Get('dashboard')
  @Roles('COACH')
  getDashboard(@CurrentUser() user: any) {
    return this.coachService.getDashboard(user.id);
  }

  @Get('groups')
  @Roles('COACH')
  getGroups(@CurrentUser() user: any): Promise<any[]> {
    return this.coachService.getGroups(user.id);
  }

  @Get('groups/:id')
  @Roles('COACH')
  getGroupDetails(@CurrentUser() user: any, @Param('id') id: string): Promise<any> {
    return this.coachService.getGroupDetails(user.id, id);
  }

  @Get('students')
  @Roles('COACH')
  getStudents(@CurrentUser() user: any) {
    return this.coachService.getStudents(user.id);
  }
}
