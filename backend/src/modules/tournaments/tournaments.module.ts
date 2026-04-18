import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TournamentsService } from './tournaments.service';
import { TournamentsAdminController } from './tournaments-admin.controller';
import { TournamentsCoachController } from './tournaments-coach.controller';
import { TournamentsParentController } from './tournaments-parent.controller';
import { TournamentsStudentController } from './tournaments-student.controller';
import { Tournament, TournamentSchema } from '../../schemas/tournament.schema';
import { TournamentParticipant, TournamentParticipantSchema } from '../../schemas/tournament-participant.schema';
import { TournamentResult, TournamentResultSchema } from '../../schemas/tournament-result.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';
import { ProgressSnapshot, ProgressSnapshotSchema } from '../../schemas/progress-snapshot.schema';
import { Achievement, AchievementSchema } from '../../schemas/achievement.schema';
import { FeedPost, FeedPostSchema } from '../../schemas/feed-post.schema';
import { Notification, NotificationSchema } from '../../schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tournament.name, schema: TournamentSchema },
      { name: TournamentParticipant.name, schema: TournamentParticipantSchema },
      { name: TournamentResult.name, schema: TournamentResultSchema },
      { name: Child.name, schema: ChildSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
      { name: ProgressSnapshot.name, schema: ProgressSnapshotSchema },
      { name: Achievement.name, schema: AchievementSchema },
      { name: FeedPost.name, schema: FeedPostSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [
    TournamentsAdminController,
    TournamentsCoachController,
    TournamentsParentController,
    TournamentsStudentController,
  ],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
