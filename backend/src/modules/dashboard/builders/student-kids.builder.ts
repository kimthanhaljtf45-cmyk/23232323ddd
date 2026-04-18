import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../../schemas/child.schema';
import { User, UserDocument } from '../../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../../schemas/attendance.schema';
import { Schedule, ScheduleDocument } from '../../../schemas/schedule.schema';
import { Achievement, AchievementDocument } from '../../../schemas/achievement.schema';
import { ProgressSnapshot, ProgressSnapshotDocument } from '../../../schemas/progress-snapshot.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

/**
 * Student Kids Builder
 * For students in KIDS program
 * Shows: belt progress, rating, achievements, goals, tournaments
 */
@Injectable()
export class StudentKidsBuilder {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Achievement.name) private achievementModel: Model<AchievementDocument>,
    @InjectModel(ProgressSnapshot.name) private progressModel: Model<ProgressSnapshotDocument>,
  ) {}

  async build(user: any) {
    const userId = user._id.toString();
    
    // Find child record for this student
    const child = await this.childModel.findOne({ userId }) ||
                  await this.childModel.findOne({ telegramId: user.telegramId });

    if (!child) {
      return this.buildEmptyDashboard();
    }

    const childId = child._id.toString();

    // Get progress
    const progress = await this.progressModel.findOne({ childId });
    const progressPercent = progress?.progressPercent || 0;

    // Get attendance stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const attendances = await this.attendanceModel.find({
      childId,
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    });
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const total = attendances.length || 1;
    const attendancePercent = Math.round((present / total) * 100);

    // Get achievements
    const achievements = await this.achievementModel
      .find({ childId })
      .sort({ awardedAt: -1 })
      .limit(5);

    // Get next training
    const nextTraining = await this.getNextTraining(child);

    // Calculate rating (simplified)
    const ratingScore = Math.round(attendancePercent * 0.5 + progressPercent * 0.5);

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. My Belt Block
    blocks.push({
      type: 'MY_BELT',
      priority: 1,
      items: [{
        currentBelt: child.belt || 'WHITE',
        progressPercent,
        nextBelt: this.getNextBelt(child.belt || 'WHITE'),
        isReadyForExam: progressPercent >= 85,
        message: progressPercent >= 85 ? 'Готовий до атестації!' : `До наступного поясу: ${100 - progressPercent}%`,
      }],
    });

    // 2. My Progress Block
    blocks.push({
      type: 'MY_PROGRESS',
      priority: 2,
      items: [{
        progressPercent,
        attendancePercent,
        monthlyGoal: child.monthlyGoalTarget || 12,
        monthlyAttended: present,
        streak: await this.calculateStreak(childId),
      }],
    });

    // 3. My Rating Block
    blocks.push({
      type: 'MY_RATING',
      priority: 3,
      items: [{
        score: ratingScore,
        rankInGroup: 'TBD', // Would calculate from rating service
        rankInClub: 'TBD',
        trend: 'stable',
      }],
    });

    // 4. My Goals Block
    blocks.push({
      type: 'MY_GOALS',
      priority: 4,
      items: [
        {
          type: 'ATTENDANCE',
          title: 'Відвідати тренувань',
          target: child.monthlyGoalTarget || 12,
          current: present,
          unit: 'тренувань',
        },
        {
          type: 'BELT',
          title: 'Досягти наступного поясу',
          target: 100,
          current: progressPercent,
          unit: '%',
        },
      ],
    });

    // 5. Achievements Block
    if (achievements.length > 0) {
      blocks.push({
        type: 'MY_ACHIEVEMENTS',
        priority: 5,
        items: achievements.map(a => ({
          id: a._id.toString(),
          title: a.title,
          description: a.description,
          type: a.type,
          awardedAt: a.awardedAt,
          icon: this.getAchievementIcon(a.type),
        })),
      });
    }

    // 6. Next Training Block
    if (nextTraining) {
      blocks.push({
        type: 'NEXT_TRAINING',
        priority: 6,
        items: [nextTraining],
      });
    }

    // 7. Quick Actions
    blocks.push({
      type: 'QUICK_ACTIONS',
      priority: 7,
      items: [
        { title: 'Мій прогрес', icon: 'trending-up-outline', screen: '/student/[id]', params: { id: childId } },
        { title: 'Рейтинг', icon: 'trophy-outline', screen: '/rating' },
        { title: 'Розклад', icon: 'calendar-outline', screen: '/(tabs)/schedule' },
      ],
    });

    return {
      role: 'STUDENT',
      programType: 'KIDS',
      header: {
        title: `Привіт, ${child.firstName}!`,
        subtitle: 'Твої досягнення в АТАКА',
      },
      state: {
        currentBelt: child.belt || 'WHITE',
        progressPercent,
        isReadyForExam: progressPercent >= 85,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }

  private buildEmptyDashboard() {
    return {
      role: 'STUDENT',
      programType: 'KIDS',
      header: {
        title: 'Ласкаво просимо!',
        subtitle: 'Завершіть реєстрацію',
      },
      state: {},
      blocks: [{
        type: 'WELCOME_CTA',
        priority: 1,
        items: [{
          title: 'Завершіть налаштування профілю',
          message: 'Зверніться до адміністратора для завершення реєстрації',
        }],
      }],
    };
  }

  private getNextBelt(currentBelt: string): string {
    const belts = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'];
    const idx = belts.indexOf(currentBelt);
    return idx < belts.length - 1 ? belts[idx + 1] : 'BLACK';
  }

  private getAchievementIcon(type: string): string {
    const icons: Record<string, string> = {
      'FIRST_MONTH': 'star-outline',
      'ATTENDANCE_STREAK': 'flame-outline',
      'BELT_PROMOTION': 'medal-outline',
      'TOURNAMENT_WIN': 'trophy-outline',
      'PERFECT_MONTH': 'checkmark-circle-outline',
    };
    return icons[type] || 'ribbon-outline';
  }

  private async calculateStreak(childId: string): Promise<number> {
    const attendances = await this.attendanceModel
      .find({ childId })
      .sort({ date: -1 })
      .limit(20);

    let streak = 0;
    for (const a of attendances) {
      if (a.status === 'PRESENT') streak++;
      else break;
    }
    return streak;
  }

  private async getNextTraining(child: ChildDocument) {
    if (!child.groupId) return null;

    const schedules = await this.scheduleModel.find({ groupId: child.groupId, isActive: true });
    if (schedules.length === 0) return null;

    const now = new Date();
    const dayOfWeek = now.getDay() || 7;

    let nearest = null;
    let minDays = 8;

    for (const s of schedules) {
      let daysUntil = s.dayOfWeek - dayOfWeek;
      if (daysUntil <= 0) daysUntil += 7;
      
      if (daysUntil < minDays) {
        minDays = daysUntil;
        const date = new Date(now);
        date.setDate(date.getDate() + daysUntil);
        nearest = {
          date: date.toISOString().split('T')[0],
          startTime: s.startTime,
          endTime: s.endTime,
          daysUntil,
        };
      }
    }

    return nearest;
  }
}
