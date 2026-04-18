import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AdminGroupsController } from './admin-groups.controller';
import { AdminGroupsService } from './admin-groups.service';

import { Group, GroupSchema } from '../../schemas/group.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import {
  CoachProfile,
  CoachProfileSchema,
} from '../../schemas/coach-profile.schema';
import { Club, ClubSchema } from '../../schemas/club.schema';
import { User, UserSchema } from '../../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: Child.name, schema: ChildSchema },
      { name: CoachProfile.name, schema: CoachProfileSchema },
      { name: Club.name, schema: ClubSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminGroupsController],
  providers: [AdminGroupsService],
  exports: [AdminGroupsService],
})
export class AdminGroupsModule {}
