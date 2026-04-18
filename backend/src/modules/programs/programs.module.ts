import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProgramsService } from './programs.service';
import { ProgramsController } from './programs.controller';
import { AdminProgramsController } from './admin-programs.controller';
import { Program, ProgramSchema } from '../../schemas/program.schema';
import { CoachProfile, CoachProfileSchema } from '../../schemas/coach-profile.schema';
import { User, UserSchema } from '../../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Program.name, schema: ProgramSchema },
      { name: CoachProfile.name, schema: CoachProfileSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ProgramsController, AdminProgramsController],
  providers: [ProgramsService],
  exports: [ProgramsService],
})
export class ProgramsModule {}
