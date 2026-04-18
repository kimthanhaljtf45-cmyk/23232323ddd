import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TiersService } from './tiers.service';
import { TiersController } from './tiers.controller';
import { AdminTiersController } from './admin-tiers.controller';
import { MembershipTier, MembershipTierSchema } from '../../schemas/membership-tier.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MembershipTier.name, schema: MembershipTierSchema },
    ]),
  ],
  controllers: [TiersController, AdminTiersController],
  providers: [TiersService],
  exports: [TiersService],
})
export class TiersModule {}
