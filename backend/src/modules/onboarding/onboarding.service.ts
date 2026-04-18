import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../schemas/user.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { EnrollmentIntent, EnrollmentIntentDocument } from '../../schemas/enrollment-intent.schema';
import { Progress, ProgressDocument } from '../../schemas/progress.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';

const PROGRAM_MESSAGES = {
  KIDS: 'Формуємо дисципліну, координацію та впевненість з раннього віку',
  SPECIAL: 'Делікатний, уважний і адаптивний формат розвитку',
  ADULT_SELF_DEFENSE: 'Практичні навички самозахисту, впевненість і контроль',
  ADULT_PRIVATE: 'Персональний формат під вашу ціль і ритм',
  CONSULTATION: 'Допоможемо підібрати правильний формат',
};

@Injectable()
export class OnboardingService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(EnrollmentIntent.name) private enrollmentIntentModel: Model<EnrollmentIntentDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async selectProgram(userId: string, programType: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      programType,
      onboardingStage: 'program_selected',
    });

    const user = await this.userModel.findById(userId);
    
    await this.enrollmentIntentModel.findOneAndUpdate(
      { userId },
      {
        userId,
        role: user?.role || 'PARENT',
        programType,
        status: 'NEW',
      },
      { upsert: true, new: true }
    );

    return { success: true, programType };
  }

  /**
   * P0.2 FIX: submitOnboarding now creates ParentChild link + fills required Child fields
   */
  async submitOnboarding(
    userId: string,
    data: {
      childName?: string;
      age?: number;
      goal?: string;
      district?: string;
      preferredSchedule?: string[];
      specialNotes?: string;
    }
  ) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new Error('User not found');

    // Update enrollment intent
    await this.enrollmentIntentModel.findOneAndUpdate(
      { userId },
      {
        ...data,
        status: 'REVIEW',
      }
    );

    // Mark user as onboarded
    await this.userModel.findByIdAndUpdate(userId, {
      isOnboarded: true,
      onboardingStage: 'completed',
    });

    // If child info provided and user is parent, create child with FULL data
    if (data.childName && user.role === 'PARENT') {
      const programType = user.programType || 'KIDS';

      // Find best matching group for auto-assignment
      const assignResult = await this.autoAssignToGroup(programType, data.district);

      const child = await this.childModel.create({
        firstName: data.childName,
        age: data.age,
        programType,
        clubId: assignResult.clubId,
        groupId: assignResult.groupId,
        coachId: assignResult.coachId,
        roleOwnerId: userId,
        isActive: true,
        belt: 'WHITE',
        monthlyGoalTarget: 12,
        status: 'ACTIVE',
      });

      // P0.2 FIX: CREATE ParentChild link — CRITICAL
      await this.parentChildModel.create({
        parentId: userId,
        childId: child._id.toString(),
        relation: 'parent',
      });

      // Create initial progress
      await this.progressModel.create({
        childId: child._id.toString(),
        currentBelt: 'WHITE',
        nextBelt: 'YELLOW',
        progressPercent: 0,
        trainingsToNextBelt: 24,
        trainingsCompleted: 0,
      });
    }

    return { success: true, message: 'Дякуємо! Ваша заявка прийнята.' };
  }

  /**
   * Auto-assign child to best group based on programType and district
   */
  private async autoAssignToGroup(programType: string, district?: string): Promise<{
    clubId: string;
    groupId: string;
    coachId: string;
  }> {
    // Try to find a group matching program type
    const groups = await this.groupModel.find({
      programType,
      isActive: true,
      coachId: { $exists: true, $ne: null },
    });

    if (groups.length === 0) {
      // Fallback: find ANY active group
      const anyGroup = await this.groupModel.findOne({
        isActive: true,
        coachId: { $exists: true, $ne: null },
      });

      if (anyGroup) {
        return {
          clubId: anyGroup.clubId || 'default',
          groupId: anyGroup._id.toString(),
          coachId: anyGroup.coachId,
        };
      }

      // Last resort: use placeholder values (admin will assign later)
      return {
        clubId: 'pending',
        groupId: 'pending',
        coachId: 'pending',
      };
    }

    // Try to match by district
    if (district) {
      for (const group of groups) {
        if (group.locationId) {
          const location = await this.locationModel.findById(group.locationId);
          if (location && location.district === district) {
            return {
              clubId: group.clubId || location._id.toString(),
              groupId: group._id.toString(),
              coachId: group.coachId,
            };
          }
        }
      }
    }

    // Default: first matching group
    const selected = groups[0];
    return {
      clubId: selected.clubId || 'default',
      groupId: selected._id.toString(),
      coachId: selected.coachId,
    };
  }

  async getRecommendation(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new Error('User not found');

    const programType = user.programType || 'KIDS';
    const intent = await this.enrollmentIntentModel.findOne({ userId });

    // Find matching groups
    const groups = await this.groupModel.find({ programType }).limit(10);
    
    let recommendedGroup = null;
    if (groups.length > 0) {
      if (intent?.district) {
        for (const g of groups) {
          if (g.locationId) {
            const location = await this.locationModel.findById(g.locationId);
            if (location && location.district === intent.district) {
              recommendedGroup = this.serialize(g);
              recommendedGroup['location'] = this.serialize(location);
              break;
            }
          }
        }
      }

      if (!recommendedGroup) {
        recommendedGroup = this.serialize(groups[0]);
        if (groups[0].locationId) {
          const location = await this.locationModel.findById(groups[0].locationId);
          if (location) {
            recommendedGroup['location'] = this.serialize(location);
          }
        }
      }
    }

    let actions = [];
    if (programType === 'KIDS' || programType === 'SELF_DEFENSE') {
      actions = [
        { type: 'BOOK_TRIAL', title: 'Записатись на пробне' },
        { type: 'OPEN_SCHEDULE', title: 'Переглянути розклад' },
      ];
    } else if (programType === 'SPECIAL') {
      actions = [
        { type: 'REQUEST_CALL', title: 'Залишити заявку на дзвінок' },
        { type: 'CONTACT', title: 'Написати нам' },
      ];
    } else {
      actions = [
        { type: 'REQUEST_CALL', title: 'Замовити консультацію' },
        { type: 'VIEW_PROGRAMS', title: 'Переглянути програми' },
      ];
    }

    return {
      programType,
      recommendedGroup,
      actions,
      message: PROGRAM_MESSAGES[programType] || '',
    };
  }
}
