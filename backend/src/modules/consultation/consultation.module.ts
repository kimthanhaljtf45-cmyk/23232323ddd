import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { ConsultationController } from './consultation.controller';
import { ConsultationAdminController } from './consultation-admin.controller';
import { ConsultationService } from './consultation.service';

import { Consultation, ConsultationSchema } from '../../schemas/consultation.schema';
import { User, UserSchema } from '../../schemas/user.schema';
import { Child, ChildSchema } from '../../schemas/child.schema';
import { ParentChild, ParentChildSchema } from '../../schemas/parent-child.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Consultation.name, schema: ConsultationSchema },
      { name: User.name, schema: UserSchema },
      { name: Child.name, schema: ChildSchema },
      { name: ParentChild.name, schema: ParentChildSchema },
    ]),
  ],
  controllers: [ConsultationController, ConsultationAdminController],
  providers: [ConsultationService],
  exports: [ConsultationService],
})
export class ConsultationModule {}
