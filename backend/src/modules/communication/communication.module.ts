import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunicationController } from './communication.controller';
import { LegacyMessagesController } from './legacy-messages.controller';
import { CommunicationService } from './communication.service';
import { Thread, ThreadSchema } from '../../schemas/thread.schema';
import { CommunicationMessage, CommunicationMessageSchema } from '../../schemas/communication-message.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Thread.name, schema: ThreadSchema },
      { name: CommunicationMessage.name, schema: CommunicationMessageSchema },
      { name: User.name, schema: UserSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
      { name: Child.name, schema: ChildSchema },
    ]),
  ],
  controllers: [CommunicationController, LegacyMessagesController],
  providers: [CommunicationService],
  exports: [CommunicationService],
})
export class CommunicationModule {}
