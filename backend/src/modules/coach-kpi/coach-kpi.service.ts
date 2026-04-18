import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CoachKPI, CoachKPIDocument } from '../../schemas/coach-kpi.schema';
import { Consultation, ConsultationDocument } from '../../schemas/consultation.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { ClubMembership, ClubMembershipDocument } from '../../schemas/club-membership.schema';
import { User, UserDocument } from '../../schemas/user.schema';

@Injectable()
export class CoachKPIService {
  private readonly logger = new Logger('CoachKPI');

  constructor(
    @InjectModel(CoachKPI.name) private kpiModel: Model<CoachKPIDocument>,
    @InjectModel(Consultation.name) private consultModel: Model<ConsultationDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(ClubMembership.name) private membershipModel: Model<ClubMembershipDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    const { _id, __v, ...rest } = obj;
    return { id: _id?.toString(), ...rest };
  }

  // === CALCULATE INDIVIDUAL COACH SCORE ===

  async calculateCoachScore(coachId: string, clubId: string) {
    // Attendance rate
    const totalSessions = await this.attendanceModel.countDocuments({ coachId });
    const presentSessions = await this.attendanceModel.countDocuments({ coachId, status: 'PRESENT' });
    const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 75;

    // Retention: how many students are still active
    const groups = await this.groupModel.find({ coachId, clubId }).lean();
    const groupIds = groups.map(g => g._id.toString());
    const totalStudents = await this.childModel.countDocuments({ groupId: { $in: groupIds }, clubId });
    const activeStudents = await this.childModel.countDocuments({ groupId: { $in: groupIds }, clubId, isActive: true });
    const retentionRate = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 80;

    // Conversion rate from leads
    const leadsTotal = await this.consultModel.countDocuments({ assignedCoachId: coachId });
    const leadsConverted = await this.consultModel.countDocuments({ assignedCoachId: coachId, status: 'CONVERTED' });
    const conversionRate = leadsTotal > 0 ? Math.round((leadsConverted / leadsTotal) * 100) : 0;

    // Actions count (messages, contacts, etc.)
    const actionsCount = leadsTotal + totalSessions;

    // Average response time
    const responseLeads = await this.consultModel.find({
      assignedCoachId: coachId,
      responseTimeMinutes: { $exists: true, $gt: 0 },
    }).lean();
    const avgResponseMinutes = responseLeads.length > 0
      ? Math.round(responseLeads.reduce((s, l) => s + (l.responseTimeMinutes || 0), 0) / responseLeads.length)
      : 0;

    // Composite score (40% attendance + 30% retention + 20% conversion + 10% actions)
    const rawScore = attendanceRate * 0.4 + retentionRate * 0.3 + conversionRate * 0.2 + Math.min(actionsCount, 100) * 0.1;
    const score = Math.round(Math.min(rawScore, 100));

    return {
      attendanceRate, retentionRate, conversionRate,
      actionsCount, avgResponseMinutes,
      studentsCount: totalStudents,
      groupsCount: groups.length,
      leadsHandled: leadsTotal,
      leadsConverted,
      score,
    };
  }

  // === RECALCULATE ALL COACHES ===

  async recalculateAll(clubId: string) {
    const memberships = await this.membershipModel.find({ clubId, role: 'COACH', status: 'ACTIVE' }).lean();
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const results: any[] = [];

    for (const m of memberships) {
      const user = await this.userModel.findById(m.userId).lean();
      if (!user) continue;

      const data = await this.calculateCoachScore(m.userId, clubId);
      const prev = await this.kpiModel.findOne({ coachId: m.userId, period }).lean();
      const previousScore = prev ? prev.score : data.score;
      const trend = data.score > previousScore ? 'UP' : data.score < previousScore ? 'DOWN' : 'STABLE';

      await this.kpiModel.updateOne(
        { coachId: m.userId, period },
        {
          $set: {
            ...data, clubId, period, trend, previousScore,
            coachName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          },
        },
        { upsert: true },
      );

      results.push({ coachId: m.userId, name: `${user.firstName || ''} ${user.lastName || ''}`.trim(), ...data, trend });
    }

    // Assign ranks
    results.sort((a, b) => b.score - a.score);
    for (let i = 0; i < results.length; i++) {
      results[i].rank = i + 1;
      await this.kpiModel.updateOne({ coachId: results[i].coachId, period }, { $set: { rank: i + 1 } });
    }

    this.logger.log(`Recalculated KPI for ${results.length} coaches in club ${clubId}`);
    return results;
  }

  // === LEADERBOARD ===

  async getLeaderboard(clubId: string) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let kpis = await this.kpiModel.find({ clubId, period }).sort({ score: -1 }).lean();

    // If no KPI data for this period, recalculate
    if (kpis.length === 0) {
      const recalced = await this.recalculateAll(clubId);
      return recalced;
    }

    return kpis.map((k, i) => ({
      coachId: k.coachId,
      name: k.coachName,
      score: k.score,
      rank: i + 1,
      trend: k.trend,
      attendanceRate: k.attendanceRate,
      retentionRate: k.retentionRate,
      conversionRate: k.conversionRate,
      studentsCount: k.studentsCount,
      groupsCount: k.groupsCount,
      leadsHandled: k.leadsHandled,
      leadsConverted: k.leadsConverted,
      avgResponseMinutes: k.avgResponseMinutes,
    }));
  }

  // === INDIVIDUAL COACH CARD ===

  async getCoachCard(coachId: string, clubId: string) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let kpi = await this.kpiModel.findOne({ coachId, period, clubId }).lean();

    if (!kpi) {
      await this.recalculateAll(clubId);
      kpi = await this.kpiModel.findOne({ coachId, period, clubId }).lean();
    }

    if (!kpi) return null;

    return {
      coachId: kpi.coachId,
      name: kpi.coachName,
      score: kpi.score,
      rank: kpi.rank,
      trend: kpi.trend,
      attendanceRate: kpi.attendanceRate,
      retentionRate: kpi.retentionRate,
      conversionRate: kpi.conversionRate,
      studentsCount: kpi.studentsCount,
      groupsCount: kpi.groupsCount,
      leadsHandled: kpi.leadsHandled,
      leadsConverted: kpi.leadsConverted,
      avgResponseMinutes: kpi.avgResponseMinutes,
    };
  }

  // === LEADS AUTO-DISTRIBUTION (SMART) ===

  async autoAssignLead(clubId: string, leadId: string) {
    const coaches = await this.membershipModel.find({ clubId, role: 'COACH', status: 'ACTIVE' }).lean();
    if (coaches.length === 0) return null;

    // Get load + KPI for each coach
    const stats = await Promise.all(
      coaches.map(async (c) => {
        const load = await this.consultModel.countDocuments({
          assignedCoachId: c.userId,
          status: { $in: ['NEW', 'ASSIGNED', 'CONTACTED'] },
        });
        const kpi = await this.kpiModel.findOne({ coachId: c.userId }).lean();
        return { coachId: c.userId, load, score: kpi?.score || 50 };
      }),
    );

    // Sort: highest KPI + lowest load first
    stats.sort((a, b) => (b.score - a.score) + (a.load - b.load) * 2);

    const selected = stats[0];

    await this.consultModel.updateOne(
      { _id: leadId },
      { $set: { assignedCoachId: selected.coachId, status: 'ASSIGNED', assignedAt: new Date() } },
    );

    this.logger.log(`Lead ${leadId} auto-assigned to coach ${selected.coachId} (score: ${selected.score}, load: ${selected.load})`);
    return { coachId: selected.coachId, load: selected.load, score: selected.score };
  }

  // === LEAD SCORING ===

  async scoreLead(leadId: string) {
    const lead = await this.consultModel.findById(leadId).lean() as any;
    if (!lead) return null;

    let score = 50; // baseline

    // Source scoring
    if (lead.source === 'REFERRAL') score += 30;
    else if (lead.source === 'QR') score += 20;
    else if (lead.source === 'INSTAGRAM') score += 10;
    else if (lead.source === 'SITE') score += 15;

    // Program type
    if (lead.programType === 'KIDS') score += 10;

    // Has child info
    if (lead.childName) score += 5;

    // Freshness
    const hours = (Date.now() - new Date(lead.createdAt).getTime()) / 3600000;
    if (hours < 2) score += 15;
    else if (hours < 24) score += 5;
    else if (hours > 48) score -= 15;

    // Response tracking
    if (lead.firstResponseAt) score += 10;
    else if (hours > 4) score -= 10;

    score = Math.max(0, Math.min(100, score));
    const priority = score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD';

    await this.consultModel.updateOne(
      { _id: leadId },
      { $set: { score, priority } },
    );

    return { score, priority };
  }
}
