import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';

import { ParentKidsBuilder } from './builders/parent-kids.builder';
import { ParentSpecialBuilder } from './builders/parent-special.builder';
import { StudentKidsBuilder } from './builders/student-kids.builder';
import { StudentAdultBuilder } from './builders/student-adult.builder';
import { CoachDashboardBuilder } from './builders/coach-dashboard.builder';
import { AdminDashboardBuilder } from './builders/admin-dashboard.builder';
import { ConsultationDashboardBuilder } from './builders/consultation-dashboard.builder';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly parentKidsBuilder: ParentKidsBuilder,
    private readonly parentSpecialBuilder: ParentSpecialBuilder,
    private readonly studentKidsBuilder: StudentKidsBuilder,
    private readonly studentAdultBuilder: StudentAdultBuilder,
    private readonly coachDashboardBuilder: CoachDashboardBuilder,
    private readonly adminDashboardBuilder: AdminDashboardBuilder,
    private readonly consultationDashboardBuilder: ConsultationDashboardBuilder,
  ) {}

  async getDashboard(userId: string, role: string, programType?: string) {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return this.consultationDashboardBuilder.build(null);
    }

    const program = programType || user.programType || 'CONSULTATION';

    // PARENT role
    if (role === 'PARENT') {
      if (program === 'KIDS') {
        return this.parentKidsBuilder.build(user);
      }
      if (program === 'SPECIAL') {
        return this.parentSpecialBuilder.build(user);
      }
      // Default for parents with other programs
      return this.parentKidsBuilder.build(user);
    }

    // STUDENT role
    if (role === 'STUDENT') {
      if (program === 'KIDS') {
        return this.studentKidsBuilder.build(user);
      }
      if (program === 'ADULT_SELF_DEFENSE' || program === 'ADULT_PRIVATE') {
        return this.studentAdultBuilder.build(user);
      }
      return this.studentKidsBuilder.build(user);
    }

    // COACH role
    if (role === 'COACH') {
      return this.coachDashboardBuilder.build(user);
    }

    // ADMIN role
    if (role === 'ADMIN') {
      return this.adminDashboardBuilder.build(user);
    }

    // GUEST / CONSULTATION
    return this.consultationDashboardBuilder.build(user);
  }
}
