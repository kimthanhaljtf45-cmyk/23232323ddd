import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RetentionSnapshot, RetentionSnapshotDocument, RetentionEntityType, EngagementStatus, DropOffRisk } from '../../schemas/retention-snapshot.schema';

export interface UpdateRetentionDto {
  streak?: number;
  monthlyGoalCurrent?: number;
  monthlyGoalTarget?: number;
  engagementStatus?: EngagementStatus;
  dropOffRisk?: DropOffRisk;
  nextMilestone?: { type: string; title: string; progress?: number };
  recentAchievements?: Array<{ type: string; title: string; awardedAt: Date }>;
  recommendations?: Array<{ type: string; title: string }>;
  totalTrainingsThisMonth?: number;
  attendanceRate?: number;
  lastVisitDate?: Date;
  daysSinceLastVisit?: number;
  riskScore?: number;
}

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(
    @InjectModel(RetentionSnapshot.name) private snapshotModel: Model<RetentionSnapshotDocument>,
  ) {}

  async getOrCreate(entityId: string, entityType: RetentionEntityType): Promise<RetentionSnapshot> {
    let snapshot = await this.snapshotModel.findOne({ entityId, entityType }).exec();
    
    if (!snapshot) {
      snapshot = new this.snapshotModel({
        entityId,
        entityType,
        streak: 0,
        monthlyGoalCurrent: 0,
        monthlyGoalTarget: 12,
        engagementStatus: 'stable',
        dropOffRisk: 'low',
        recentAchievements: [],
        recommendations: [],
      });
      await snapshot.save();
    }

    return snapshot;
  }

  async update(entityId: string, entityType: RetentionEntityType, data: UpdateRetentionDto): Promise<RetentionSnapshot> {
    return this.snapshotModel.findOneAndUpdate(
      { entityId, entityType },
      { $set: data },
      { new: true, upsert: true },
    ).exec();
  }

  async getByChild(childId: string): Promise<RetentionSnapshot | null> {
    return this.snapshotModel.findOne({ entityId: childId, entityType: 'CHILD' }).exec();
  }

  async getByParent(parentId: string): Promise<RetentionSnapshot | null> {
    return this.snapshotModel.findOne({ entityId: parentId, entityType: 'PARENT' }).exec();
  }

  async getByStudent(studentId: string): Promise<RetentionSnapshot | null> {
    return this.snapshotModel.findOne({ entityId: studentId, entityType: 'STUDENT' }).exec();
  }

  async getAtRisk(riskLevel?: DropOffRisk): Promise<RetentionSnapshot[]> {
    const query: any = {};
    if (riskLevel) {
      query.dropOffRisk = riskLevel;
    } else {
      query.dropOffRisk = { $in: ['warning', 'critical'] };
    }
    return this.snapshotModel.find(query).sort({ riskScore: -1 }).exec();
  }

  async getTopPerformers(limit = 10): Promise<RetentionSnapshot[]> {
    return this.snapshotModel.find({
      engagementStatus: 'good',
    }).sort({ streak: -1, attendanceRate: -1 }).limit(limit).exec();
  }

  async addAchievement(entityId: string, entityType: RetentionEntityType, achievement: { type: string; title: string }): Promise<void> {
    await this.snapshotModel.updateOne(
      { entityId, entityType },
      {
        $push: {
          recentAchievements: {
            $each: [{ ...achievement, awardedAt: new Date() }],
            $slice: -5, // Keep only last 5
          },
        },
      },
    ).exec();
  }

  async getRetentionStats(): Promise<{
    totalActive: number;
    goodEngagement: number;
    warningEngagement: number;
    criticalEngagement: number;
    averageStreak: number;
    averageAttendance: number;
  }> {
    const snapshots = await this.snapshotModel.find({}).exec();
    
    const total = snapshots.length;
    if (total === 0) {
      return {
        totalActive: 0,
        goodEngagement: 0,
        warningEngagement: 0,
        criticalEngagement: 0,
        averageStreak: 0,
        averageAttendance: 0,
      };
    }

    const good = snapshots.filter(s => s.engagementStatus === 'good').length;
    const warning = snapshots.filter(s => s.engagementStatus === 'warning').length;
    const critical = snapshots.filter(s => s.engagementStatus === 'critical').length;
    const totalStreak = snapshots.reduce((sum, s) => sum + s.streak, 0);
    const totalAttendance = snapshots.reduce((sum, s) => sum + s.attendanceRate, 0);

    return {
      totalActive: total,
      goodEngagement: good,
      warningEngagement: warning,
      criticalEngagement: critical,
      averageStreak: Math.round(totalStreak / total * 10) / 10,
      averageAttendance: Math.round(totalAttendance / total * 10) / 10,
    };
  }
}
