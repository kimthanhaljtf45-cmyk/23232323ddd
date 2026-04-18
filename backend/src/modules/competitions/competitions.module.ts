import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CompetitionsService } from './competitions.service';
import { CompetitionsController } from './competitions.controller';
import { AdminCompetitionsController } from './admin-competitions.controller';

import {
  Competition,
  CompetitionSchema,
} from '../../schemas/competition.schema';
import {
  CompetitionParticipant,
  CompetitionParticipantSchema,
} from '../../schemas/competition-participant.schema';
import {
  CompetitionResult,
  CompetitionResultSchema,
} from '../../schemas/competition-result.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Invoice, InvoiceSchema } from '../../schemas/invoice.schema';
import { Alert, AlertSchema } from '../../schemas/alert.schema';
import { FeedPost, FeedPostSchema } from '../../schemas/feed-post.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Competition.name, schema: CompetitionSchema },
      {
        name: CompetitionParticipant.name,
        schema: CompetitionParticipantSchema,
      },
      { name: CompetitionResult.name, schema: CompetitionResultSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: FeedPost.name, schema: FeedPostSchema },
      { name: User.name, schema: UserSchema },
      { name: Group.name, schema: GroupSchema },
    ]),
  ],
  controllers: [CompetitionsController, AdminCompetitionsController],
  providers: [CompetitionsService],
  exports: [CompetitionsService],
})
export class CompetitionsModule {}
