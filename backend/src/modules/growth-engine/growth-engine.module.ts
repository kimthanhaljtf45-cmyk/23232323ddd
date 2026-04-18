import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GrowthEngineService } from './growth-engine.service';
import { GrowthEngineController } from './growth-engine.controller';
import { OfferVariant, OfferVariantSchema } from '../../schemas/offer-variant.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OfferVariant.name, schema: OfferVariantSchema },
    ]),
  ],
  controllers: [GrowthEngineController],
  providers: [GrowthEngineService],
  exports: [GrowthEngineService],
})
export class GrowthEngineModule {}
