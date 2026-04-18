import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { RetentionService } from './retention.service';
import { AlertsService } from '../alerts/alerts.service';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Progress, ProgressDocument } from '../../schemas/progress.schema';
import { CompetitionResult, CompetitionResultDocument } from '../../schemas/competition-result.schema';
import { CompetitionParticipant, CompetitionParticipantDocument } from '../../schemas/competition-participant.schema';
import { Competition, CompetitionDocument } from '../../schemas/competition.schema';
import { EngagementStatus, DropOffRisk } from '../../schemas/retention-snapshot.schema';

// Medal bonus points for risk reduction
const MEDAL_RISK_BONUS = {
  GOLD: 20,
  SILVER: 10,
  BRONZE: 5,
  PARTICIPATION: 2,
};

// Penalty for no-show at competition
const NO_SHOW_PENALTY = 25;

@Injectable()
export class RetentionEngine {
  private readonly logger = new Logger(RetentionEngine.name);

  // Belt progression order
  private readonly beltOrder = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'PURPLE', 'BROWN', 'BLACK'];

  constructor(
    private readonly retentionService: RetentionService,
    private readonly alertsService: AlertsService,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Progress.name) private progressModel: Model<ProgressDocument>,
    @InjectModel(CompetitionResult.name) private resultModel: Model<CompetitionResultDocument>,
    @InjectModel(CompetitionParticipant.name) private participantModel: Model<CompetitionParticipantDocument>,
    @InjectModel(Competition.name) private competitionModel: Model<CompetitionDocument>,
  ) {}

  // Run every 6 hours
  @Cron('0 */6 * * *')
  async recalculateAll() {
    this.logger.log('Starting retention recalculation...');
    
    let processed = 0;

    // Process children
    const children = await this.childModel.find({ status: 'ACTIVE' }).exec();
    for (const child of children) {
      await this.recalculateChild((child as any)._id.toString());
      processed++;
    }

    // Process adult students
    const students = await this.userModel.find({ role: 'STUDENT', status: 'ACTIVE' }).exec();
    for (const student of students) {
      await this.recalculateStudent((student as any)._id.toString());
      processed++;
    }

    this.logger.log(`Retention recalculation complete. Processed ${processed} entities.`);
    return { processed };
  }

  async recalculateChild(childId: string): Promise<void> {
    const child = await this.childModel.findById(childId).exec();
    if (!child) return;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get attendance records
    const allAttendance = await this.attendanceModel.find({
      childId,
      date: { $gte: thirtyDaysAgo },
    }).sort({ date: -1 }).exec();

    const monthlyAttendance = await this.attendanceModel.find({
      childId,
      date: { $gte: startOfMonth },
    }).exec();

    // Calculate streak
    const streak = this.calculateStreak(allAttendance);

    // Calculate monthly goal
    const monthlyGoalCurrent = monthlyAttendance.filter(a => a.status === 'PRESENT').length;
    const monthlyGoalTarget = child.monthlyGoalTarget || 12;

    // Calculate attendance rate
    const total = allAttendance.length;
    const present = allAttendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 100;

    // Last visit
    const lastPresent = allAttendance.find(a => a.status === 'PRESENT');
    const lastVisitDate = lastPresent ? new Date(lastPresent.date) : undefined;
    const daysSinceLastVisit = lastVisitDate 
      ? Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24))
      : 30;

    // ===== METABRAIN: Competition Impact =====
    const competitionBonus = await this.calculateCompetitionBonus(childId);
    const competitionPenalty = await this.calculateCompetitionPenalty(childId);
    const competitionRecommendations = await this.generateCompetitionRecommendations(childId);

    // Determine engagement status and drop-off risk with competition impact
    const { engagementStatus, dropOffRisk, riskScore } = this.calculateRisk(
      streak,
      attendanceRate,
      daysSinceLastVisit,
      competitionBonus,
      competitionPenalty,
    );

    // Generate recommendations (including competition-based)
    const baseRecommendations = this.generateRecommendations(
      monthlyGoalCurrent,
      monthlyGoalTarget,
      streak,
      attendanceRate,
    );
    const recommendations = [...baseRecommendations, ...competitionRecommendations];

    // Calculate next milestone (belt progress)
    const nextMilestone = await this.calculateNextMilestone(childId, child.belt);

    // Check for new achievements
    const achievements = await this.checkAchievements(childId, streak, monthlyGoalCurrent, monthlyGoalTarget);

    // Update retention snapshot
    await this.retentionService.update(childId, 'CHILD', {
      streak,
      monthlyGoalCurrent,
      monthlyGoalTarget,
      engagementStatus,
      dropOffRisk,
      riskScore,
      nextMilestone,
      recommendations,
      totalTrainingsThisMonth: monthlyGoalCurrent,
      attendanceRate,
      lastVisitDate,
      daysSinceLastVisit,
    });

    // Add achievements
    for (const achievement of achievements) {
      await this.retentionService.addAchievement(childId, 'CHILD', achievement);
    }

    // Create alerts for retention issues
    if (dropOffRisk === 'critical' && child.userId) {
      await this.alertsService.create({
        userId: child.userId,
        childId,
        type: 'DROP_OFF_RISK',
        severity: 'critical',
        title: `${child.firstName}: ризик втрати`,
        message: 'Потрібна увага! Учень може припинити заняття.',
        meta: { riskScore, daysSinceLastVisit, attendanceRate },
      });
    }

    // Goal almost done notification
    const goalProgress = monthlyGoalTarget > 0 ? (monthlyGoalCurrent / monthlyGoalTarget) * 100 : 0;
    if (goalProgress >= 75 && goalProgress < 100 && child.userId) {
      await this.alertsService.create({
        userId: child.userId,
        childId,
        type: 'GOAL_ALMOST_DONE',
        severity: 'info',
        title: `${child.firstName}: майже досягнув цілі!`,
        message: `${monthlyGoalCurrent} з ${monthlyGoalTarget} тренувань цього місяця`,
        meta: { monthlyGoalCurrent, monthlyGoalTarget },
      });
    }
  }

  async recalculateStudent(studentId: string): Promise<void> {
    // Similar logic for adult students
    const student = await this.userModel.findById(studentId).exec();
    if (!student) return;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // For adult students, attendance might be linked differently
    // This is a simplified version
    const snapshot = await this.retentionService.getOrCreate(studentId, 'STUDENT');
    
    // Update with default values for now
    await this.retentionService.update(studentId, 'STUDENT', {
      engagementStatus: 'stable',
      dropOffRisk: 'low',
      recommendations: [
        { type: 'MAINTAIN_CONSISTENCY', title: 'Продовжуйте регулярні тренування' },
      ],
    });
  }

  private calculateStreak(attendances: AttendanceDocument[]): number {
    let streak = 0;
    for (const a of attendances) {
      if (a.status === 'PRESENT') {
        streak++;
      } else if (a.status === 'ABSENT') {
        break;
      }
      // WARNED doesn't break streak
    }
    return streak;
  }

  private calculateRisk(
    streak: number,
    attendanceRate: number,
    daysSinceLastVisit: number,
    competitionBonus: number = 0,
    competitionPenalty: number = 0,
  ): { engagementStatus: EngagementStatus; dropOffRisk: DropOffRisk; riskScore: number } {
    let riskScore = 0;

    // Attendance contribution (0-40 points)
    if (attendanceRate < 50) riskScore += 40;
    else if (attendanceRate < 70) riskScore += 25;
    else if (attendanceRate < 85) riskScore += 10;

    // Days since last visit (0-35 points)
    if (daysSinceLastVisit >= 14) riskScore += 35;
    else if (daysSinceLastVisit >= 7) riskScore += 20;
    else if (daysSinceLastVisit >= 4) riskScore += 10;

    // Streak bonus (negative risk, -25 to 0)
    if (streak >= 5) riskScore -= 25;
    else if (streak >= 3) riskScore -= 15;
    else if (streak >= 1) riskScore -= 5;

    // ===== COMPETITION IMPACT =====
    // Medal bonus reduces risk
    riskScore -= competitionBonus;
    // No-show penalty increases risk
    riskScore += competitionPenalty;

    riskScore = Math.max(0, Math.min(100, riskScore));

    let engagementStatus: EngagementStatus;
    let dropOffRisk: DropOffRisk;

    if (riskScore >= 60) {
      engagementStatus = 'critical';
      dropOffRisk = 'critical';
    } else if (riskScore >= 30) {
      engagementStatus = 'warning';
      dropOffRisk = 'warning';
    } else if (streak >= 3 && attendanceRate >= 80) {
      engagementStatus = 'good';
      dropOffRisk = 'low';
    } else {
      engagementStatus = 'stable';
      dropOffRisk = 'low';
    }

    return { engagementStatus, dropOffRisk, riskScore };
  }

  private generateRecommendations(
    current: number,
    target: number,
    streak: number,
    attendanceRate: number,
  ): Array<{ type: string; title: string }> {
    const recommendations: Array<{ type: string; title: string }> = [];

    const remaining = target - current;
    const now = new Date();
    const daysLeftInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

    if (remaining > 0 && remaining <= daysLeftInMonth / 2) {
      recommendations.push({
        type: 'ATTEND_THIS_WEEK',
        title: `Відвідайте ще ${remaining} тренувань до кінця місяця`,
      });
    }

    if (streak === 0) {
      recommendations.push({
        type: 'START_STREAK',
        title: 'Почніть нову серію тренувань!',
      });
    } else if (streak >= 3 && streak < 5) {
      recommendations.push({
        type: 'KEEP_STREAK',
        title: `Ще ${5 - streak} тренувань до досягнення!`,
      });
    }

    if (attendanceRate < 70) {
      recommendations.push({
        type: 'IMPROVE_ATTENDANCE',
        title: 'Покращте відвідуваність для кращого прогресу',
      });
    }

    return recommendations;
  }

  private async calculateNextMilestone(childId: string, currentBelt: string): Promise<{ type: string; title: string; progress?: number } | undefined> {
    const currentIndex = this.beltOrder.indexOf(currentBelt);
    if (currentIndex === -1 || currentIndex >= this.beltOrder.length - 1) {
      return undefined;
    }

    const nextBelt = this.beltOrder[currentIndex + 1];

    // Get progress towards next belt
    const progress = await this.progressModel.findOne({ childId }).sort({ createdAt: -1 }).exec();
    const progressPercent = progress?.progressPercent || 0;

    return {
      type: 'BELT',
      title: `До ${nextBelt} поясу залишилось ${100 - progressPercent}%`,
      progress: progressPercent,
    };
  }

  private async checkAchievements(
    childId: string,
    streak: number,
    currentGoal: number,
    targetGoal: number,
  ): Promise<Array<{ type: string; title: string }>> {
    const achievements: Array<{ type: string; title: string }> = [];

    // Streak achievements
    if (streak === 5) {
      achievements.push({ type: 'STREAK_5', title: '5 тренувань поспіль!' });
    } else if (streak === 10) {
      achievements.push({ type: 'STREAK_10', title: '10 тренувань поспіль!' });
    }

    // Goal achievement
    if (currentGoal >= targetGoal) {
      achievements.push({ type: 'MONTHLY_GOAL', title: 'Місячна ціль досягнута!' });
    }

    return achievements;
  }

  // ===== METABRAIN COMPETITION INTEGRATION =====
  
  /**
   * Calculate competition bonus from medal wins
   * Reduces risk score based on recent achievements
   */
  async calculateCompetitionBonus(childId: string): Promise<number> {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const results = await this.resultModel.find({
      childId,
      createdAt: { $gte: sixMonthsAgo },
    }).exec();

    let bonus = 0;
    for (const r of results) {
      const medalBonus = MEDAL_RISK_BONUS[r.medal as keyof typeof MEDAL_RISK_BONUS] || 0;
      bonus += medalBonus;
    }

    // Cap bonus at 40 points
    return Math.min(bonus, 40);
  }

  /**
   * Calculate penalty for competition no-shows
   * Increases risk score when student is confirmed but didn't attend
   */
  async calculateCompetitionPenalty(childId: string): Promise<number> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Get finished competitions in last 3 months
    const competitions = await this.competitionModel.find({
      status: 'FINISHED',
      date: { $gte: threeMonthsAgo.toISOString().slice(0, 10) },
    }).exec();

    const competitionIds = competitions.map(c => c._id.toString());

    // Get child's participations
    const participants = await this.participantModel.find({
      childId,
      competitionId: { $in: competitionIds },
      status: 'CONFIRMED',
    }).exec();

    // Check for no-shows (confirmed but no result)
    let penalty = 0;
    for (const p of participants) {
      const result = await this.resultModel.findOne({
        childId,
        competitionId: p.competitionId,
      }).exec();

      if (!result) {
        // Confirmed but didn't show up
        penalty += NO_SHOW_PENALTY;
      }
    }

    // Cap penalty at 50 points
    return Math.min(penalty, 50);
  }

  /**
   * Generate competition-related recommendations
   */
  async generateCompetitionRecommendations(childId: string): Promise<Array<{ type: string; title: string }>> {
    const recommendations: Array<{ type: string; title: string }> = [];

    // Check recent results
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

    const recentResults = await this.resultModel.find({
      childId,
      createdAt: { $gte: twoMonthsAgo },
    }).exec();

    // Check for medal wins
    const goldWins = recentResults.filter(r => r.medal === 'GOLD').length;
    const anyMedals = recentResults.filter(r => ['GOLD', 'SILVER', 'BRONZE'].includes(r.medal)).length;
    const participations = recentResults.filter(r => r.medal === 'PARTICIPATION').length;

    if (goldWins > 0) {
      recommendations.push({
        type: 'COMPETITION_GOLD',
        title: 'Запропонувати складнішу групу',
      });
    }

    if (participations > 0 && anyMedals === 0) {
      recommendations.push({
        type: 'COMPETITION_SUPPORT',
        title: 'Підтримати учня після змагань',
      });
    }

    // Check for no-shows
    const competitions = await this.competitionModel.find({
      status: 'FINISHED',
      date: { $gte: twoMonthsAgo.toISOString().slice(0, 10) },
    }).exec();

    const compIds = competitions.map(c => c._id.toString());
    const confirmedParticipants = await this.participantModel.find({
      childId,
      competitionId: { $in: compIds },
      status: 'CONFIRMED',
    }).exec();

    for (const p of confirmedParticipants) {
      const result = await this.resultModel.findOne({
        childId,
        competitionId: p.competitionId,
      }).exec();

      if (!result) {
        recommendations.push({
          type: 'COMPETITION_NO_SHOW',
          title: 'Зв\'язатись: пропуск змагань',
        });
        break; // Only one recommendation for no-shows
      }
    }

    return recommendations;
  }
}
