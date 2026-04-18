import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopController } from './shop.controller';
import { ShopService } from './shop.service';
import { ProductSchema } from '../../schemas/product.schema';
import { CartSchema } from '../../schemas/cart.schema';
import { OrderSchema } from '../../schemas/order.schema';
import { UserSchema } from '../../schemas/user.schema';
import { ProductRecommendationSchema } from '../../schemas/product-recommendation.schema';
import { InventoryLogSchema } from '../../schemas/inventory-log.schema';
import { CampaignSchema } from '../../schemas/campaign.schema';
import { NotificationSchema } from '../../schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Product', schema: ProductSchema },
      { name: 'Cart', schema: CartSchema },
      { name: 'Order', schema: OrderSchema },
      { name: 'User', schema: UserSchema },
      { name: 'ProductRecommendation', schema: ProductRecommendationSchema },
      { name: 'InventoryLog', schema: InventoryLogSchema },
      { name: 'Campaign', schema: CampaignSchema },
      { name: 'Notification', schema: NotificationSchema },
    ]),
  ],
  controllers: [ShopController],
  providers: [ShopService],
  exports: [ShopService],
})
export class ShopModule {}
