import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Booking, BookingDocument } from '../../schemas/booking.schema';
import { BookingSlot, BookingSlotDocument } from '../../schemas/booking-slot.schema';
import { CoachAvailability, CoachAvailabilityDocument } from '../../schemas/coach-availability.schema';
import { CoachProfile, CoachProfileDocument } from '../../schemas/coach-profile.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { MembershipTier, MembershipTierDocument } from '../../schemas/membership-tier.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { TiersService } from '../tiers/tiers.service';
import {
  CreateBookingDto,
  CreateAvailabilityDto,
  UpdateBookingStatusDto,
  GenerateSlotsDto,
} from './booking.dto';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(BookingSlot.name) private slotModel: Model<BookingSlotDocument>,
    @InjectModel(CoachAvailability.name) private availabilityModel: Model<CoachAvailabilityDocument>,
    @InjectModel(CoachProfile.name) private coachModel: Model<CoachProfileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(MembershipTier.name) private tierModel: Model<MembershipTierDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    private tiersService: TiersService,
  ) {}

  // ==================== AVAILABILITY ====================

  async createAvailability(dto: CreateAvailabilityDto): Promise<CoachAvailability> {
    const availability = new this.availabilityModel(dto);
    return availability.save();
  }

  async getCoachAvailability(coachId: string): Promise<CoachAvailability[]> {
    return this.availabilityModel.find({ coachId, isActive: true }).exec();
  }

  async updateAvailability(id: string, dto: Partial<CreateAvailabilityDto>): Promise<CoachAvailability> {
    const availability = await this.availabilityModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!availability) throw new NotFoundException('Availability not found');
    return availability;
  }

  async deleteAvailability(id: string): Promise<void> {
    await this.availabilityModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // ==================== SLOTS ====================

  async generateSlots(dto: GenerateSlotsDto): Promise<BookingSlot[]> {
    const { coachId, clubId, startDate, endDate, slotDuration = 60, type = 'PERSONAL' } = dto;

    const availability = await this.getCoachAvailability(coachId);
    if (availability.length === 0) {
      throw new BadRequestException('No availability configured for this coach');
    }

    const slots: BookingSlot[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // 1-7, Monday-Sunday
      const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

      for (const avail of dayAvailability) {
        const dateStr = d.toISOString().split('T')[0];
        const [startHour, startMin] = avail.startTime.split(':').map(Number);
        const [endHour, endMin] = avail.endTime.split(':').map(Number);

        let currentTime = startHour * 60 + startMin;
        const endTime = endHour * 60 + endMin;

        while (currentTime + slotDuration <= endTime) {
          const slotStart = `${Math.floor(currentTime / 60).toString().padStart(2, '0')}:${(currentTime % 60).toString().padStart(2, '0')}`;
          const slotEnd = `${Math.floor((currentTime + slotDuration) / 60).toString().padStart(2, '0')}:${((currentTime + slotDuration) % 60).toString().padStart(2, '0')}`;

          // Перевірка чи слот вже існує
          const existing = await this.slotModel.findOne({
            coachId,
            date: dateStr,
            startTime: slotStart,
          }).exec();

          if (!existing) {
            const slot = new this.slotModel({
              clubId,
              coachId,
              date: dateStr,
              startTime: slotStart,
              endTime: slotEnd,
              duration: slotDuration,
              status: 'AVAILABLE',
              type,
            });
            const saved = await slot.save();
            slots.push(saved);
          }

          currentTime += slotDuration;
        }
      }
    }

    return slots;
  }

  async getSlots(coachId: string, date: string, type?: string): Promise<BookingSlot[]> {
    const query: any = { coachId, date, status: 'AVAILABLE' };
    if (type) query.type = type;
    return this.slotModel.find(query).sort({ startTime: 1 }).exec();
  }

  async getAllSlotsForDate(coachId: string, date: string): Promise<BookingSlot[]> {
    return this.slotModel.find({ coachId, date }).sort({ startTime: 1 }).exec();
  }

  // ==================== BOOKING ====================

  async createBooking(dto: CreateBookingDto, userId: string): Promise<Booking> {
    const slot = await this.slotModel.findById(dto.slotId).exec();
    if (!slot) throw new NotFoundException('Slot not found');
    if (slot.status !== 'AVAILABLE') throw new BadRequestException('Slot is not available');

    // Перевірка на дублювання - учасник не може мати 2 записи на один час
    const existingUserBooking = await this.bookingModel.findOne({
      userId,
      date: slot.date,
      startTime: slot.startTime,
      status: { $nin: ['CANCELLED'] },
    }).exec();

    if (existingUserBooking) {
      throw new BadRequestException('You already have a booking at this time');
    }

    // Розрахунок ціни
    const price = await this.calculatePrice(dto.type, dto.coachId, userId, dto.childId);

    // Створення бронювання
    const booking = new this.bookingModel({
      clubId: slot.clubId,
      coachId: dto.coachId,
      userId,
      childId: dto.childId,
      slotId: slot._id,
      type: dto.type,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      price,
      note: dto.note,
      status: 'PENDING',
    });

    const saved = await booking.save();

    // Оновлення статусу слота
    await this.slotModel.findByIdAndUpdate(slot._id, {
      status: 'BOOKED',
      bookingId: saved._id.toString(),
    }).exec();

    // Створення Invoice якщо платне
    if (price > 0) {
      const invoice = new this.invoiceModel({
        userId,
        childId: dto.childId,
        amount: price,
        type: 'BOOKING',
        description: `${dto.type} - ${slot.date} ${slot.startTime}`,
        status: 'PENDING',
        dueDate: new Date(slot.date),
      });
      const savedInvoice = await invoice.save();
      await this.bookingModel.findByIdAndUpdate(saved._id, { invoiceId: savedInvoice._id.toString() }).exec();
    }

    return this.findOne(saved._id.toString());
  }

  async calculatePrice(type: string, coachId: string, userId: string, childId?: string): Promise<number> {
    // Базові ціни
    const basePrices: Record<string, number> = {
      PERSONAL: 800,
      TRIAL: 0,
      CONSULTATION: 0,
    };

    let basePrice = basePrices[type] || 800;

    // Ставка тренера (може бути різною)
    const coach = await this.coachModel.findOne({ userId: coachId }).exec();
    // Можна додати поле hourlyRate до CoachProfile

    // Знижка по tier
    if (type === 'PERSONAL' && childId) {
      const subscription = await this.subscriptionModel.findOne({
        childId,
        status: 'ACTIVE',
      }).exec();

      if (subscription && (subscription as any).tierId) {
        try {
          const discount = await this.tiersService.getPersonalDiscount((subscription as any).tierId);
          basePrice = basePrice * (1 - discount / 100);
        } catch (e) {
          // Ігноруємо помилки
        }
      }
    }

    return Math.round(basePrice);
  }

  async findOne(id: string): Promise<any> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    const coach = await this.userModel.findById(booking.coachId).exec();
    const user = await this.userModel.findById(booking.userId).exec();

    return {
      ...booking.toObject(),
      _id: booking._id.toString(),
      coachName: coach?.firstName || 'Unknown',
      studentName: user?.firstName || 'Unknown',
      dateLabel: `${booking.date} • ${booking.startTime} - ${booking.endTime}`,
    };
  }

  async getUserBookings(userId: string): Promise<any[]> {
    const bookings = await this.bookingModel
      .find({ userId })
      .sort({ date: -1, startTime: -1 })
      .exec();

    return Promise.all(bookings.map(b => this.findOne(b._id.toString())));
  }

  async getCoachBookings(coachId: string, date?: string): Promise<any[]> {
    const query: any = { coachId };
    if (date) query.date = date;

    const bookings = await this.bookingModel
      .find(query)
      .sort({ date: 1, startTime: 1 })
      .exec();

    return Promise.all(bookings.map(b => this.findOne(b._id.toString())));
  }

  async getCoachTodayBookings(coachId: string): Promise<any[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getCoachBookings(coachId, today);
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto, actorId: string): Promise<Booking> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException('Booking not found');

    // Перевірка прав (user може тільки скасувати, coach може все)
    if (booking.userId !== actorId && booking.coachId !== actorId) {
      // TODO: перевірка на admin
    }

    const updateData: any = { status: dto.status };

    if (dto.status === 'CANCELLED') {
      updateData.cancelReason = dto.cancelReason;
      updateData.cancelledAt = new Date();

      // Відкрити слот
      await this.slotModel.findByIdAndUpdate(booking.slotId, {
        status: 'AVAILABLE',
        bookingId: null,
      }).exec();
    }

    const updated = await this.bookingModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    return this.findOne(updated._id.toString());
  }

  async cancelBooking(id: string, userId: string, reason?: string): Promise<Booking> {
    return this.updateStatus(id, { status: 'CANCELLED', cancelReason: reason }, userId);
  }

  async confirmBooking(id: string, coachId: string): Promise<Booking> {
    return this.updateStatus(id, { status: 'CONFIRMED' }, coachId);
  }

  async markDone(id: string, coachId: string): Promise<Booking> {
    return this.updateStatus(id, { status: 'DONE' }, coachId);
  }

  async markNoShow(id: string, coachId: string): Promise<Booking> {
    return this.updateStatus(id, { status: 'NO_SHOW' }, coachId);
  }

  // ==================== COACHES FOR BOOKING ====================

  async getCoachesForBooking(type: string, clubId?: string): Promise<any[]> {
    // Шукаємо користувачів з роллю COACH
    const coachUsers = await this.userModel.find({ role: 'COACH' }).exec();

    const coaches = [];
    for (const user of coachUsers) {
      // Перевірити чи є availability
      const availability = await this.getCoachAvailability(user._id.toString());
      if (availability.length > 0) {
        const profile = await this.coachModel.findOne({ userId: user._id.toString() }).exec();
        coaches.push({
          _id: user._id.toString(),
          name: user.firstName,
          subtitle: profile?.specialization?.join(', ') || 'Тренер',
          bio: profile?.bio,
          price: 800, // Базова ставка
        });
      }
    }

    return coaches;
  }

  // ==================== ADMIN STATS ====================

  async getBookingStats(clubId?: string): Promise<any> {
    const query: any = {};
    if (clubId) query.clubId = clubId;

    const all = await this.bookingModel.find(query).exec();
    const today = new Date().toISOString().split('T')[0];

    return {
      total: all.length,
      pending: all.filter(b => b.status === 'PENDING').length,
      confirmed: all.filter(b => b.status === 'CONFIRMED').length,
      done: all.filter(b => b.status === 'DONE').length,
      noShow: all.filter(b => b.status === 'NO_SHOW').length,
      cancelled: all.filter(b => b.status === 'CANCELLED').length,
      todayCount: all.filter(b => b.date === today).length,
      revenue: all.filter(b => b.paid && b.status === 'DONE').reduce((sum, b) => sum + b.price, 0),
    };
  }
}
