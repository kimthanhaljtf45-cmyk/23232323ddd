import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification, NotificationSchema } from '../../schemas/notification.schema';
import { DeviceToken, DeviceTokenSchema } from '../../schemas/device-token.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeviceToken.name, schema: DeviceTokenSchema },
      { name: Child.name, schema: ChildSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
