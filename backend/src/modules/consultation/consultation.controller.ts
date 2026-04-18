import { Body, Controller, Post, Req, UseGuards, Get } from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('consultations')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  // Public endpoint - anyone can submit a consultation request
  @Post()
  create(@Body() dto: CreateConsultationDto) {
    return this.consultationService.create(dto);
  }

  // Authenticated endpoint - for logged in users
  @Post('auth')
  @UseGuards(JwtAuthGuard)
  createFromAuth(@Req() req: any, @Body() dto: CreateConsultationDto) {
    return this.consultationService.create(dto, req.user.id);
  }
}
