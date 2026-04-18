import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { LocationSchema } from '../../schemas/location.schema';
import { ProgramSchema } from '../../schemas/program.schema';
import { UserSchema } from '../../schemas/user.schema';
import { GroupSchema } from '../../schemas/group.schema';
import { CoachProfileSchema } from '../../schemas/coach-profile.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Location', schema: LocationSchema },
      { name: 'Program', schema: ProgramSchema },
      { name: 'User', schema: UserSchema },
      { name: 'Group', schema: GroupSchema },
      { name: 'CoachProfile', schema: CoachProfileSchema },
    ]),
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
