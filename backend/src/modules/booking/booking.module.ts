import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { CoachBookingController } from './coach-booking.controller';
import { AdminBookingController } from './admin-booking.controller';
import { Booking, BookingSchema } from '../../schemas/booking.schema';
import { BookingSlot, BookingSlotSchema } from '../../schemas/booking-slot.schema';
import { CoachAvailability, CoachAvailabilitySchema } from '../../schemas/coach-availability.schema';
import { CoachProfile, CoachProfileSchema } from '../../schemas/coach-profile.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { MembershipTier, MembershipTierSchema } from '../../schemas/membership-tier.schema';
import { Subscription, SubscriptionSchema } from '../../schemas/subscription.schema';
import { TiersModule } from '../tiers/tiers.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      { name: BookingSlot.name, schema: BookingSlotSchema },
      { name: CoachAvailability.name, schema: CoachAvailabilitySchema },
      { name: CoachProfile.name, schema: CoachProfileSchema },
      { name: User.name, schema: UserSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: MembershipTier.name, schema: MembershipTierSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    TiersModule,
  ],
  controllers: [BookingController, CoachBookingController, AdminBookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
