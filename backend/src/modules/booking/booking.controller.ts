import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto, CancelBookingDto } from './booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('booking')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // Отримати доступні слоти
  @Get('slots')
  getSlots(
    @Query('coachId') coachId: string,
    @Query('date') date: string,
    @Query('type') type?: string,
  ) {
    return this.bookingService.getSlots(coachId, date, type);
  }

  // Отримати тренерів для бронювання
  @Get('coaches')
  getCoaches(@Query('type') type: string, @Query('clubId') clubId?: string) {
    return this.bookingService.getCoachesForBooking(type, clubId);
  }

  // Створити бронювання
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateBookingDto, @Request() req: any) {
    return this.bookingService.createBooking(dto, req.user._id);
  }

  // Мої бронювання
  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyBookings(@Request() req: any) {
    return this.bookingService.getUserBookings(req.user._id);
  }

  // Деталі бронювання
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  getOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  // Скасувати
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@Param('id') id: string, @Body() dto: CancelBookingDto, @Request() req: any) {
    return this.bookingService.cancelBooking(id, req.user._id, dto.reason);
  }
}
