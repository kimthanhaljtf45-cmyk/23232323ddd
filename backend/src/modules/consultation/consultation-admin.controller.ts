import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';
import { AssignConsultationDto } from './dto/assign-consultation.dto';
import { ConvertConsultationDto } from './dto/convert-consultation.dto';

@Controller('admin/consultations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ConsultationAdminController {
  constructor(private readonly consultationService: ConsultationService) {}

  @Get()
  getList(
    @Query('status') status?: string,
    @Query('assignedToAdminId') assignedToAdminId?: string,
    @Query('programType') programType?: string,
  ) {
    return this.consultationService.getList({
      status,
      assignedToAdminId,
      programType,
    });
  }

  @Get('board')
  getBoard() {
    return this.consultationService.getBoard();
  }

  @Get('stats')
  getStats() {
    return this.consultationService.getStats();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.consultationService.getById(id);
  }

  @Patch(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignConsultationDto) {
    return this.consultationService.assign(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateConsultationStatusDto) {
    return this.consultationService.updateStatus(id, dto);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() dto: ConvertConsultationDto) {
    return this.consultationService.convert(id, dto);
  }
}
