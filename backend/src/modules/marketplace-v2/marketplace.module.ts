import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { CoachPerformance, CoachPerformanceSchema } from '../../schemas/coach-performance.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController, AdminMarketplaceController } from './marketplace.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: Child.name, schema: ChildSchema },
      { name: User.name, schema: UserSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: CoachPerformance.name, schema: CoachPerformanceSchema },
      { name: Location.name, schema: LocationSchema },
    ]),
    AuthModule,
  ],
  controllers: [MarketplaceController, AdminMarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceV2Module {}
