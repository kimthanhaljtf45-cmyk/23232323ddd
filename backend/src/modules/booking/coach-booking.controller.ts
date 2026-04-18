import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('coach/booking')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('COACH', 'ADMIN')
export class CoachBookingController {
  constructor(private readonly bookingService: BookingService) {}

  // Бронювання тренера
  @Get()
  getMyBookings(@Request() req: any, @Query('date') date?: string) {
    return this.bookingService.getCoachBookings(req.user._id, date);
  }

  // Бронювання сьогодні
  @Get('today')
  getTodayBookings(@Request() req: any) {
    return this.bookingService.getCoachTodayBookings(req.user._id);
  }

  // Деталі бронювання
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  // Підтвердити
  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @Request() req: any) {
    return this.bookingService.confirmBooking(id, req.user._id);
  }

  // Завершено
  @Patch(':id/done')
  markDone(@Param('id') id: string, @Request() req: any) {
    return this.bookingService.markDone(id, req.user._id);
  }

  // No-show
  @Patch(':id/no-show')
  markNoShow(@Param('id') id: string, @Request() req: any) {
    return this.bookingService.markNoShow(id, req.user._id);
  }

  // Скасувати
  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.bookingService.cancelBooking(id, req.user._id, 'Cancelled by coach');
  }
}
