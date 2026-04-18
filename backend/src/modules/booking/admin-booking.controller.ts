import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateAvailabilityDto, GenerateSlotsDto } from './booking.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/booking')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminBookingController {
  constructor(private readonly bookingService: BookingService) {}

  // ==================== AVAILABILITY ====================

  @Post('availability')
  createAvailability(@Body() dto: CreateAvailabilityDto) {
    return this.bookingService.createAvailability(dto);
  }

  @Get('availability/:coachId')
  getCoachAvailability(@Param('coachId') coachId: string) {
    return this.bookingService.getCoachAvailability(coachId);
  }

  @Patch('availability/:id')
  updateAvailability(@Param('id') id: string, @Body() dto: Partial<CreateAvailabilityDto>) {
    return this.bookingService.updateAvailability(id, dto);
  }

  @Delete('availability/:id')
  deleteAvailability(@Param('id') id: string) {
    return this.bookingService.deleteAvailability(id);
  }

  // ==================== SLOTS ====================

  @Post('generate-slots')
  generateSlots(@Body() dto: GenerateSlotsDto) {
    return this.bookingService.generateSlots(dto);
  }

  @Get('slots/:coachId')
  getAllSlots(@Param('coachId') coachId: string, @Query('date') date: string) {
    return this.bookingService.getAllSlotsForDate(coachId, date);
  }

  // ==================== BOOKINGS ====================

  @Get('all')
  getAllBookings(@Query('coachId') coachId?: string, @Query('date') date?: string) {
    if (coachId) {
      return this.bookingService.getCoachBookings(coachId, date);
    }
    return this.bookingService.getBookingStats();
  }

  @Get('stats')
  getStats(@Query('clubId') clubId?: string) {
    return this.bookingService.getBookingStats(clubId);
  }
}
