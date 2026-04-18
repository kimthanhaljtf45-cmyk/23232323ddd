import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Achievement, AchievementDocument } from '../../schemas/achievement.schema';

// Belt configuration
const BELT_RULES = [
  { belt: 'WHITE', order: 1, requiredAttendance: 0, requiredMonths: 0, requiresCoachApproval: false },
  { belt: 'YELLOW', order: 2, requiredAttendance: 12, requiredMonths: 1, requiresCoachApproval: true },
  { belt: 'ORANGE', order: 3, requiredAttendance: 20, requiredMonths: 2, requiresCoachApproval: true },
  { belt: 'GREEN', order: 4, requiredAttendance: 28, requiredMonths: 3, requiresCoachApproval: true },
  { belt: 'BLUE', order: 5, requiredAttendance: 40, requiredMonths: 4, requiresCoachApproval: true },
  { belt: 'BROWN', order: 6, requiredAttendance: 55, requiredMonths: 6, requiresCoachApproval: true },
  { belt: 'BLACK', order: 7, requiredAttendance: 80, requiredMonths: 12, requiresCoachApproval: true },
];

function getBeltRule(belt: string) {
  return BELT_RULES.find((r) => r.belt === belt) || null;
}

function getNextBelt(belt: string): string | null {
  const current = getBeltRule(belt);
  if (!current) return null;
  const next = BELT_RULES.find((r) => r.order === current.order + 1);
  return next ? next.belt : null;
}

function clamp(value: number, min = 0, max = 100): number {
  if (isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,
    @InjectModel(Achievement.name)
    private readonly achievementModel: Model<AchievementDocument>,
  ) {}

  async recalculateChildProgress(childId: string) {
    console.log(`Progress recalculated for child ${childId}`);
    // Actual recalculation happens in getChildProgress
    return { childId, recalculated: true };
  }

  async getChildProgress(childId: string) {
    const child = await this.childModel.findById(childId);
    if (!child) {
      throw new Error('Child not found');
    }

    const currentBelt = child.belt || 'WHITE';
    const nextBelt = getNextBelt(currentBelt);

    // Get all attendance records
    const attendance = await this.attendanceModel
      .find({ childId })
      .sort({ date: 1 });

    // Count by status
    const presentCount = attendance.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendance.filter((a) => a.status === 'ABSENT').length;
    const warnedCount = attendance.filter((a) => a.status === 'WARNED').length;
    const lateCount = attendance.filter((a) => a.status === 'LATE').length;
    const total = presentCount + absentCount + warnedCount + lateCount;

    // Calculate metrics
    const attendancePercent = total > 0 ? clamp((presentCount / total) * 100) : 0;

    // Discipline score (weighted)
    const weighted = presentCount * 1.0 + warnedCount * 0.6 + lateCount * 0.5 + absentCount * 0.0;
    const disciplineScore = total > 0 ? clamp((weighted / total) * 100) : 0;

    // Calculate streak
    let streak = 0;
    const sorted = attendance
      .filter((a) => a.status !== 'CANCELLED')
      .sort((a, b) => (a.date > b.date ? -1 : 1));

    for (const record of sorted) {
      if (record.status === 'PRESENT' || record.status === 'LATE') {
        streak++;
      } else {
        break;
      }
    }

    // Calculate trend
    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    const recent = attendance.filter((a) => new Date(a.date) >= twoWeeksAgo);
    const previous = attendance.filter(
      (a) => new Date(a.date) >= fourWeeksAgo && new Date(a.date) < twoWeeksAgo,
    );

    const recentScore = recent.length > 0
      ? recent.filter((a) => a.status === 'PRESENT').length / recent.length * 100
      : 0;
    const previousScore = previous.length > 0
      ? previous.filter((a) => a.status === 'PRESENT').length / previous.length * 100
      : 0;

    let trend = 'stable';
    if (recentScore >= previousScore + 5) trend = 'up';
    else if (recentScore <= previousScore - 5) trend = 'down';

    // Monthly goal
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyPresent = attendance.filter(
      (a) => new Date(a.date) >= monthStart && a.status === 'PRESENT',
    ).length;
    const monthlyGoalTarget = child.monthlyGoalTarget || 12;

    // Months in belt (estimate from first attendance)
    let monthsInBelt = 0;
    if (attendance.length > 0) {
      const firstDate = new Date(attendance[0].date);
      const diff = now.getTime() - firstDate.getTime();
      monthsInBelt = Math.max(0, Math.floor(diff / (30 * 24 * 60 * 60 * 1000)));
    }

    // Progress to next belt
    const nextRule = nextBelt ? getBeltRule(nextBelt) : null;
    let progressPercent = 100;
    let coachApproved = child.coachApprovedForNextBelt || false;

    if (nextRule) {
      const attendanceProgress = clamp(
        (presentCount / nextRule.requiredAttendance) * 100,
      );
      const timeProgress = clamp(
        (monthsInBelt / nextRule.requiredMonths) * 100,
      );
      const coachFactor = coachApproved ? 100 : 0;

      // Weighted average: 50% attendance, 30% time, 20% coach
      progressPercent = clamp(
        attendanceProgress * 0.5 + timeProgress * 0.3 + coachFactor * 0.2,
      );
    }

    // Get achievements
    const achievements = await this.achievementModel
      .find({ childId })
      .sort({ awardedAt: -1 })
      .limit(10);

    // Ensure achievements
    await this.ensureAchievements(childId, {
      streak,
      monthlyPresent,
      attendancePercent,
    });

    return {
      childId,
      belt: {
        current: currentBelt,
        next: nextBelt,
        progressPercent,
      },
      discipline: {
        attendancePercent,
        disciplineScore,
        streak,
        trend,
        presentCount,
        absentCount,
        warnedCount,
        lateCount,
      },
      monthlyGoal: {
        target: monthlyGoalTarget,
        current: monthlyPresent,
        percent: clamp((monthlyPresent / monthlyGoalTarget) * 100),
      },
      requirements: {
        attendance: {
          current: presentCount,
          required: nextRule?.requiredAttendance || presentCount,
        },
        months: {
          current: monthsInBelt,
          required: nextRule?.requiredMonths || monthsInBelt,
        },
        coachApprovalRequired: nextRule?.requiresCoachApproval || false,
        coachApproved,
      },
      achievements: achievements.map((a) => ({
        type: a.type,
        title: a.title,
        awardedAt: a.awardedAt?.toISOString(),
      })),
      coachCommentSummary: child.coachCommentSummary,
    };
  }

  private async ensureAchievements(
    childId: string,
    metrics: { streak: number; monthlyPresent: number; attendancePercent: number },
  ) {
    const existing = await this.achievementModel.find({ childId });
    const existingTypes = new Set(existing.map((a) => a.type));
    const toCreate = [];

    if (metrics.streak >= 5 && !existingTypes.has('attendance_streak_5')) {
      toCreate.push({
        childId,
        type: 'attendance_streak_5',
        title: '5 тренувань поспіль',
        awardedAt: new Date(),
      });
    }

    if (metrics.streak >= 10 && !existingTypes.has('attendance_streak_10')) {
      toCreate.push({
        childId,
        type: 'attendance_streak_10',
        title: '10 тренувань поспіль! 🔥',
        awardedAt: new Date(),
      });
    }

    if (metrics.monthlyPresent >= 10 && !existingTypes.has('monthly_present_10')) {
      toCreate.push({
        childId,
        type: 'monthly_present_10',
        title: '10 тренувань за місяць',
        awardedAt: new Date(),
      });
    }

    if (metrics.attendancePercent >= 90 && !existingTypes.has('excellent_discipline')) {
      toCreate.push({
        childId,
        type: 'excellent_discipline',
        title: 'Відмінна дисципліна 🏆',
        awardedAt: new Date(),
      });
    }

    if (toCreate.length > 0) {
      await this.achievementModel.insertMany(toCreate);
      console.log(`Created ${toCreate.length} achievements for child ${childId}`);
    }
  }
}
