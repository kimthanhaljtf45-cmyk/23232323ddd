import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Achievement, AchievementDocument } from '../../schemas/achievement.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';

// ALLOWED PUBLIC ROLES - FROZEN
const ALLOWED_PUBLIC_ROLES = ['PARENT', 'STUDENT'];

@Injectable()
export class ChildrenService {
  constructor(
    @InjectModel(Child.name) private readonly childModel: Model<ChildDocument>,
    @InjectModel(ParentChild.name) private readonly parentChildModel: Model<ParentChildDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Location.name) private readonly locationModel: Model<LocationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Achievement.name) private readonly achievementModel: Model<AchievementDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return {
      ...obj,
      id: obj._id?.toString(),
      _id: undefined,
    };
  }

  async getChildrenForParent(parentId: string) {
    const links = await this.parentChildModel.find({ parentId });
    const childIds = links.map((l) => l.childId);

    const children = [];
    for (const childId of childIds) {
      try {
        const child = await this.childModel.findById(childId);
        if (child) {
          const childData = this.serialize(child);

          if (child.groupId) {
            const group = await this.groupModel.findById(child.groupId);
            if (group) {
              childData.group = this.serialize(group);
              if (group.coachId) {
                const coach = await this.userModel.findById(group.coachId);
                childData.coach = this.serialize(coach);
              }
              if (group.locationId) {
                const location = await this.locationModel.findById(group.locationId);
                childData.location = this.serialize(location);
              }
            }
          }

          children.push(childData);
        }
      } catch (e) {
        console.error(`Error fetching child ${childId}:`, e);
      }
    }

    return children;
  }

  async getChildById(childId: string) {
    const child = await this.childModel.findById(childId);
    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const childData = this.serialize(child);

    // Get group info
    if (child.groupId) {
      const group = await this.groupModel.findById(child.groupId);
      if (group) {
        childData.group = this.serialize(group);
        if (group.coachId) {
          const coach = await this.userModel.findById(group.coachId);
          childData.coach = this.serialize(coach);
        }
        if (group.locationId) {
          const location = await this.locationModel.findById(group.locationId);
          childData.location = this.serialize(location);
        }
      }
    }

    // Get attendance stats
    const attendance = await this.attendanceModel.find({ childId });
    const total = attendance.length;
    const present = attendance.filter((a) => a.status === 'PRESENT').length;
    const warned = attendance.filter((a) => a.status === 'WARNED').length;
    const absent = attendance.filter((a) => a.status === 'ABSENT').length;

    childData.attendance = {
      monthTotal: total,
      present,
      warned,
      absent,
      percent: total > 0 ? Math.round((present / total) * 100) : 0,
    };

    childData.goal = {
      target: 12,
      current: present,
    };

    childData.coachComment = child.note || '';

    // Get achievements
    const achievements = await this.achievementModel.find({ childId });
    childData.achievements = achievements.map((a) => this.serialize(a));

    // Get payments
    const payments = await this.paymentModel.find({ childId });
    childData.payments = payments.map((p) => this.serialize(p));

    return childData;
  }

  /**
   * AUTO-ASSIGN LOGIC
   * Assigns a child to the best matching group based on programType
   * Rules:
   * - Child must have a group
   * - Group must have a coach
   * - Finds group with least students (load balancing)
   */
  async autoAssignChild(childId: string, programType?: string): Promise<{
    groupId: string;
    coachId: string;
    clubId: string;
    groupName: string;
    coachName: string;
  }> {
    const child = await this.childModel.findById(childId);
    if (!child) {
      throw new NotFoundException('Child not found');
    }

    const targetProgramType = programType || child.programType || 'KIDS';

    // Find all active groups for this program
    const groups = await this.groupModel.find({
      programType: targetProgramType,
      isActive: true,
      coachId: { $exists: true, $ne: null },
    });

    if (groups.length === 0) {
      throw new BadRequestException(`No available groups for program: ${targetProgramType}`);
    }

    // Count students in each group
    const groupWithCounts = await Promise.all(
      groups.map(async (group) => {
        const count = await this.childModel.countDocuments({
          groupId: group._id.toString(),
          isActive: true,
        });
        return { group, count };
      })
    );

    // Sort by count (least students first) for load balancing
    groupWithCounts.sort((a, b) => a.count - b.count);

    const selectedGroup = groupWithCounts[0].group;

    // Get coach info
    const coach = await this.userModel.findById(selectedGroup.coachId);
    if (!coach) {
      throw new BadRequestException('Group has no valid coach');
    }

    // Update child with auto-assigned values
    await this.childModel.findByIdAndUpdate(childId, {
      groupId: selectedGroup._id.toString(),
      coachId: selectedGroup.coachId,
      clubId: selectedGroup.clubId || '',
      programType: targetProgramType,
    });

    return {
      groupId: selectedGroup._id.toString(),
      coachId: selectedGroup.coachId,
      clubId: selectedGroup.clubId || '',
      groupName: selectedGroup.name,
      coachName: coach.firstName || 'Coach',
    };
  }

  /**
   * VALIDATION RULES - FROZEN
   * Ensure data consistency
   */
  async validateChild(childId: string): Promise<{ valid: boolean; errors: string[] }> {
    const child = await this.childModel.findById(childId);
    if (!child) {
      return { valid: false, errors: ['Child not found'] };
    }

    const errors: string[] = [];

    // Rule 1: Child must have a group
    if (!child.groupId) {
      errors.push('Child must be assigned to a group');
    } else {
      const group = await this.groupModel.findById(child.groupId);
      if (!group) {
        errors.push('Child is assigned to non-existent group');
      } else {
        // Rule 2: Group must have a coach
        if (!group.coachId) {
          errors.push('Group has no coach assigned');
        }
        // Rule 3: Group must have a club (optional for now)
        // if (!group.clubId) {
        //   errors.push('Group has no club assigned');
        // }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
