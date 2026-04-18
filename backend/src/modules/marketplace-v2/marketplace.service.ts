import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { CoachPerformance, CoachPerformanceDocument } from '../../schemas/coach-performance.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';

export type CapacityStatus = 'FULL' | 'LAST_SPOTS' | 'AVAILABLE';

export interface MarketplaceGroup {
  id: string;
  name: string;
  programType: string;
  coach: { id: string; firstName: string; lastName: string };
  location?: { id: string; name: string; address?: string };
  rating: number;
  fillRate: number;
  studentsCount: number;
  capacity: number;
  status: CapacityStatus;
  schedule: Array<{ day: string; time: string }>;
  ageRange?: string;
  level?: string;
  monthlyPrice: number;
  badges: string[];
}

@Injectable()
export class MarketplaceService {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(CoachPerformance.name) private coachPerfModel: Model<CoachPerformanceDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
  ) {}

  // ==================== RANKING ENGINE ====================

  calculateGroupScore(group: any): number {
    const coachScore = group.coachScore ?? 50;
    const fillRate = group.fillRate ?? 0;
    const attendance = group.avgAttendance ?? 70;
    const boost = group.priorityBoost ?? 0;

    // Weighted scoring: coach quality 50%, attendance 30%, fill balance 20%
    // Lower fillRate is BETTER (more space) but not empty
    const fillBalance = fillRate > 10 && fillRate < 90 ? 100 : fillRate > 90 ? 50 : 30;

    return Math.round(
      coachScore * 0.5 +
      attendance * 0.3 +
      fillBalance * 0.2 +
      boost
    );
  }

  getCapacityStatus(fillRate: number): CapacityStatus {
    if (fillRate >= 100) return 'FULL';
    if (fillRate >= 85) return 'LAST_SPOTS';
    return 'AVAILABLE';
  }

  getBadges(group: any): string[] {
    const badges: string[] = [];
    if (group.ratingScore >= 80) badges.push('TOP_COACH');
    if (group.fillRate >= 85 && group.fillRate < 100) badges.push('POPULAR');
    if (group.fillRate >= 100) badges.push('FULL');
    if (group.fillRate < 30) badges.push('NEW_GROUP');
    if (group.priorityBoost > 0) badges.push('PROMOTED');
    return badges;
  }

  // ==================== MARKETPLACE PUBLIC API ====================

  async getMarketplaceGroups(filters?: {
    programType?: string;
    locationId?: string;
  }): Promise<MarketplaceGroup[]> {
    const query: any = { isActive: true, isPublic: true };
    if (filters?.programType) query.programType = filters.programType;
    if (filters?.locationId) query.locationId = filters.locationId;

    const groups = await this.groupModel.find(query).lean();

    const result: MarketplaceGroup[] = [];
    for (const group of groups) {
      const studentsCount = await this.childModel.countDocuments({
        groupId: group._id.toString(),
        status: 'ACTIVE',
      });

      const fillRate = group.capacity > 0 ? Math.round((studentsCount / group.capacity) * 100) : 0;
      const status = this.getCapacityStatus(fillRate);

      // Get coach info
      const coach = await this.userModel.findById(group.coachId).lean();

      // Get location
      let location: any = null;
      if (group.locationId) {
        const loc = await this.locationModel.findById(group.locationId).lean();
        if (loc) location = { id: (loc as any)._id.toString(), name: loc.name, address: loc.address };
      }

      // Calculate attendance rate for this group (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const childIds = (await this.childModel.find({ groupId: group._id.toString() })).map(c => (c as any)._id.toString());
      
      let avgAttendance = 70;
      if (childIds.length > 0) {
        const attendances = await this.attendanceModel.find({
          childId: { $in: childIds },
          date: { $gte: thirtyDaysAgo.toISOString().slice(0, 10) },
        });
        const total = attendances.length;
        const present = attendances.filter(a => a.status === 'PRESENT').length;
        avgAttendance = total > 0 ? Math.round((present / total) * 100) : 70;
      }

      // Get coach performance score
      let coachScore = 50;
      const perf = await this.coachPerfModel.findOne({ coachId: group.coachId }).lean();
      if (perf) {
        coachScore = (perf as any).overallScore ?? 50;
      }

      const enrichedGroup = {
        ...group,
        fillRate,
        avgAttendance,
        coachScore,
      };

      const rating = this.calculateGroupScore(enrichedGroup);
      const badges = this.getBadges({ ...enrichedGroup, ratingScore: rating });

      result.push({
        id: group._id.toString(),
        name: group.name,
        programType: group.programType,
        coach: coach ? {
          id: (coach as any)._id.toString(),
          firstName: coach.firstName || '',
          lastName: coach.lastName || '',
        } : { id: '', firstName: 'N/A', lastName: '' },
        location,
        rating,
        fillRate,
        studentsCount,
        capacity: group.capacity,
        status,
        schedule: group.schedule || [],
        ageRange: group.ageRange,
        level: group.level,
        monthlyPrice: group.monthlyPrice,
        badges,
      });
    }

    // Sort by rating (highest first), then by fillRate (most spots first)
    result.sort((a, b) => {
      if (a.status === 'FULL' && b.status !== 'FULL') return 1;
      if (b.status === 'FULL' && a.status !== 'FULL') return -1;
      return b.rating - a.rating;
    });

    return result;
  }

  async getGroupDetail(groupId: string): Promise<any> {
    const group = await this.groupModel.findById(groupId).lean();
    if (!group) throw new NotFoundException('Групу не знайдено');

    const studentsCount = await this.childModel.countDocuments({
      groupId: group._id.toString(),
      status: 'ACTIVE',
    });

    const fillRate = group.capacity > 0 ? Math.round((studentsCount / group.capacity) * 100) : 0;
    const coach = await this.userModel.findById(group.coachId).lean();
    let location: any = null;
    if (group.locationId) {
      const loc = await this.locationModel.findById(group.locationId).lean();
      if (loc) location = { id: (loc as any)._id.toString(), name: loc.name, address: loc.address };
    }

    return {
      id: group._id.toString(),
      name: group.name,
      programType: group.programType,
      coach: coach ? { id: (coach as any)._id.toString(), firstName: coach.firstName, lastName: coach.lastName } : null,
      location,
      fillRate,
      studentsCount,
      capacity: group.capacity,
      status: this.getCapacityStatus(fillRate),
      schedule: group.schedule || [],
      ageRange: group.ageRange,
      level: group.level,
      monthlyPrice: group.monthlyPrice,
      badges: this.getBadges({ ...group, fillRate, ratingScore: group.ratingScore || 0 }),
      description: group.description,
    };
  }

  // ==================== DISTRIBUTION ENGINE ====================

  async pickBestGroup(filters: {
    programType?: string;
    locationId?: string;
  }): Promise<MarketplaceGroup | null> {
    const groups = await this.getMarketplaceGroups(filters);
    const available = groups.filter(g => g.status !== 'FULL');
    return available.length > 0 ? available[0] : null; // Already sorted by rating
  }

  // ==================== AUTO ASSIGN ====================

  async assignStudent(childId: string, filters?: {
    programType?: string;
    locationId?: string;
    groupId?: string;
  }): Promise<any> {
    const child = await this.childModel.findById(childId);
    if (!child) throw new NotFoundException('Учня не знайдено');

    let targetGroup: any;

    if (filters?.groupId) {
      // Parent chose specific group
      targetGroup = await this.groupModel.findById(filters.groupId);
      if (!targetGroup) throw new NotFoundException('Групу не знайдено');
    } else {
      // Auto-assign: pick best available
      const best = await this.pickBestGroup({
        programType: filters?.programType,
        locationId: filters?.locationId,
      });
      if (!best) throw new BadRequestException('Немає доступних груп');
      targetGroup = await this.groupModel.findById(best.id);
    }

    // Capacity check
    const currentCount = await this.childModel.countDocuments({
      groupId: targetGroup._id.toString(),
      status: 'ACTIVE',
    });
    if (currentCount >= targetGroup.capacity) {
      // Auto redirect to next best
      const alternative = await this.pickBestGroup({
        programType: targetGroup.programType,
      });
      if (!alternative) throw new BadRequestException('Всі групи заповнені');

      targetGroup = await this.groupModel.findById(alternative.id);
      if (!targetGroup) throw new BadRequestException('Немає доступних груп');
    }

    // Assign student
    await this.childModel.updateOne(
      { _id: childId },
      {
        $set: {
          groupId: targetGroup._id.toString(),
          coachId: targetGroup.coachId,
          clubId: targetGroup.clubId,
          programType: targetGroup.programType,
        },
      },
    );

    return {
      success: true,
      groupId: targetGroup._id.toString(),
      groupName: targetGroup.name,
      coachId: targetGroup.coachId,
      message: `Учня записано до групи "${targetGroup.name}"`,
    };
  }

  // ==================== ADMIN CONTROLS ====================

  async updateVisibility(groupId: string, isPublic: boolean): Promise<any> {
    await this.groupModel.updateOne({ _id: groupId }, { $set: { isPublic } });
    return { success: true, groupId, isPublic };
  }

  async updateCapacity(groupId: string, capacity: number): Promise<any> {
    await this.groupModel.updateOne({ _id: groupId }, { $set: { capacity } });
    return { success: true, groupId, capacity };
  }

  async updateBoost(groupId: string, priorityBoost: number): Promise<any> {
    await this.groupModel.updateOne({ _id: groupId }, { $set: { priorityBoost } });
    return { success: true, groupId, priorityBoost };
  }

  // ==================== CRON: UPDATE SCORES ====================

  @Cron('*/10 * * * *')
  async updateGroupScores(): Promise<{ updated: number }> {
    const groups = await this.groupModel.find({ isActive: true });
    let updated = 0;

    for (const group of groups) {
      const studentsCount = await this.childModel.countDocuments({
        groupId: (group as any)._id.toString(),
        status: 'ACTIVE',
      });

      const fillRate = group.capacity > 0 ? Math.round((studentsCount / group.capacity) * 100) : 0;

      // Simple score calc for cron (full version in getMarketplaceGroups)
      const score = this.calculateGroupScore({
        coachScore: 50,
        fillRate,
        avgAttendance: 70,
        priorityBoost: group.priorityBoost || 0,
      });

      await this.groupModel.updateOne(
        { _id: (group as any)._id },
        { $set: { fillRate, ratingScore: score } },
      );
      updated++;
    }

    return { updated };
  }
}
