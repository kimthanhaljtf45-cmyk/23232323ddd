import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { User, UserSchema } from '../../schemas/user.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { Group, GroupSchema } from '../../schemas/group.schema';
import { Location, LocationSchema } from '../../schemas/location.schema';
import { EnrollmentIntent, EnrollmentIntentSchema } from '../../schemas/enrollment-intent.schema';
import { Progress, ProgressSchema } from '../../schemas/progress.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Child.name, schema: ChildSchema },
      { name: Group.name, schema: GroupSchema },
      { name: Location.name, schema: LocationSchema },
      { name: EnrollmentIntent.name, schema: EnrollmentIntentSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
    ]),
  ],
  controllers: [OnboardingController],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
