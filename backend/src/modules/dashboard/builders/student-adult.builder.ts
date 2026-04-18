import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../../schemas/child.schema';
import { User, UserDocument } from '../../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../../schemas/attendance.schema';
import { Schedule, ScheduleDocument } from '../../../schemas/schedule.schema';
import { CoachComment, CoachCommentDocument } from '../../../schemas/coach-comment.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

/**
 * Student Adult Builder
 * For students in ADULT_SELF_DEFENSE or ADULT_PRIVATE programs
 * Focus: personal goals, skill progress, fitness, coach feedback
 */
@Injectable()
export class StudentAdultBuilder {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Schedule.name) private scheduleModel: Model<ScheduleDocument>,
    @InjectModel(CoachComment.name) private commentModel: Model<CoachCommentDocument>,
  ) {}

  async build(user: any) {
    const userId = user._id.toString();
    
    // Find student record
    const student = await this.childModel.findOne({ userId }) ||
                    await this.childModel.findOne({ telegramId: user.telegramId });

    // Get attendance stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const attendances = student ? await this.attendanceModel.find({
      childId: student._id.toString(),
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    }) : [];
    
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const total = attendances.length || 1;
    const attendancePercent = Math.round((present / total) * 100);

    // Get next training
    const nextTraining = student ? await this.getNextTraining(student) : null;

    // Get coach feedback
    const coachFeedback = student ? await this.commentModel
      .findOne({ childId: student._id.toString() })
      .sort({ createdAt: -1 }) : null;

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. Next Training Block (most important for adults)
    if (nextTraining) {
      blocks.push({
        type: 'NEXT_TRAINING',
        priority: 1,
        items: [{
          ...nextTraining,
          message: `До тренування: ${nextTraining.daysUntil === 0 ? 'сьогодні' : nextTraining.daysUntil === 1 ? 'завтра' : `${nextTraining.daysUntil} дн.`}`,
        }],
      });
    }

    // 2. Personal Goals Block
    blocks.push({
      type: 'PERSONAL_GOALS',
      priority: 2,
      items: [
        {
          id: 'monthly_attendance',
          title: 'Тренувань цього місяця',
          target: 8,
          current: present,
          unit: 'тренувань',
          progress: Math.round((present / 8) * 100),
        },
        {
          id: 'consistency',
          title: 'Регулярність',
          target: 100,
          current: attendancePercent,
          unit: '%',
          progress: attendancePercent,
        },
      ],
    });

    // 3. Skill Progress Block (simplified for adults)
    blocks.push({
      type: 'SKILL_PROGRESS',
      priority: 3,
      items: [
        { skill: 'Базова техніка', level: 3, maxLevel: 5 },
        { skill: 'Самооборона', level: 2, maxLevel: 5 },
        { skill: 'Фізична форма', level: 3, maxLevel: 5 },
      ],
    });

    // 4. Attendance Block
    blocks.push({
      type: 'ATTENDANCE',
      priority: 4,
      items: [{
        thisMonth: present,
        attendancePercent,
        streak: await this.calculateStreak(student?._id.toString() || ''),
        message: attendancePercent >= 70 ? 'Відмінна регулярність!' : 'Рекомендуємо частіше відвідувати',
      }],
    });

    // 5. Coach Feedback Block
    if (coachFeedback) {
      blocks.push({
        type: 'COACH_FEEDBACK',
        priority: 5,
        items: [{
          text: coachFeedback.text,
          date: coachFeedback.createdAt,
        }],
      });
    }

    // 6. Quick Actions
    blocks.push({
      type: 'QUICK_ACTIONS',
      priority: 6,
      items: [
        { title: 'Розклад', icon: 'calendar-outline', screen: '/(tabs)/schedule' },
        { title: 'Написати тренеру', icon: 'chatbubble-outline', screen: '/messages' },
        { title: 'Мій профіль', icon: 'person-outline', screen: '/(tabs)/profile' },
      ],
    });

    const programType = user.programType || 'ADULT_SELF_DEFENSE';
    const isPrivate = programType === 'ADULT_PRIVATE';

    return {
      role: 'STUDENT',
      programType,
      header: {
        title: `Привіт, ${user.firstName}!`,
        subtitle: isPrivate ? 'Ваші персональні тренування' : 'Самооборона для дорослих',
      },
      state: {
        attendancePercent,
        hasNextTraining: !!nextTraining,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }

  private async getNextTraining(student: ChildDocument) {
    if (!student.groupId) return null;

    const schedules = await this.scheduleModel.find({ groupId: student.groupId, isActive: true });
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

  private async calculateStreak(childId: string): Promise<number> {
    if (!childId) return 0;
    
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
}
