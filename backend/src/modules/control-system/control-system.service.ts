import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GroupHealth, GroupHealthDocument } from '../../schemas/group-health.schema';
import { CoachPerformance, CoachPerformanceDocument } from '../../schemas/coach-performance.schema';
import { ClubHealth, ClubHealthDocument } from '../../schemas/club-health.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Tenant, TenantDocument } from '../../schemas/tenant.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';

@Injectable()
export class ControlSystemService {
  private readonly logger = new Logger(ControlSystemService.name);

  constructor(
    @InjectModel(GroupHealth.name) private groupHealthModel: Model<GroupHealthDocument>,
    @InjectModel(CoachPerformance.name) private coachPerformanceModel: Model<CoachPerformanceDocument>,
    @InjectModel(ClubHealth.name) private clubHealthModel: Model<ClubHealthDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
  ) {}

  // ==================== GROUP HEALTH ====================

  async calculateGroupHealth(groupId: string): Promise<GroupHealth> {
    const group = await this.groupModel.findById(groupId).lean();
    if (!group) throw new Error('Group not found');

    const children = await this.childModel.find({ groupId, isActive: true }).lean();
    const childIds = children.map(c => c._id.toString());
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Attendance rate (last 30 days)
    const attendances = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: monthStart },
    }).lean();

    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const totalAttendances = attendances.length;
    const attendanceRate = totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : 0;

    // Retention (children who left in last 3 months)
    const churnedChildren = await this.childModel.countDocuments({
      groupId,
      isActive: false,
      updatedAt: { $gte: threeMonthsAgo },
    });
    const totalEver = children.length + churnedChildren;
    const retentionRate = totalEver > 0 ? Math.round((children.length / totalEver) * 100) : 100;

    // Payment discipline
    const parentIds = [...new Set(children.map(c => c.parentId))];
    const invoices = await this.invoiceModel.find({
      parentId: { $in: parentIds },
      createdAt: { $gte: monthStart },
    }).lean();
    const paidOnTime = invoices.filter(inv => inv.status === 'PAID').length;
    const overdue = invoices.filter(inv => inv.status === 'OVERDUE').length;
    const paymentDiscipline = invoices.length > 0 ? Math.round((paidOnTime / invoices.length) * 100) : 100;

    // Progress rate (children who got new belt in last 3 months)
    const progressedChildren = children.filter(c => 
      (c as any).lastBeltChangeAt && new Date((c as any).lastBeltChangeAt) >= threeMonthsAgo
    ).length;
    const progressRate = children.length > 0 ? Math.round((progressedChildren / children.length) * 100) : 0;

    // Competition participation (placeholder)
    const competitionParticipation = 0; // TODO: implement

    // Calculate health score
    // 30% attendance + 30% retention + 20% progress + 20% payments
    const healthScore = Math.round(
      attendanceRate * 0.3 +
      retentionRate * 0.3 +
      progressRate * 0.2 +
      paymentDiscipline * 0.2
    );

    // Determine status
    let status: string;
    if (healthScore >= 80) status = 'EXCELLENT';
    else if (healthScore >= 60) status = 'GOOD';
    else if (healthScore >= 40) status = 'WARNING';
    else status = 'CRITICAL';

    // Save or update
    const healthData = {
      groupId,
      tenantId: (group as any).tenantId || '',
      coachId: (group as any).coachId || '',
      attendanceRate,
      retentionRate,
      paymentDiscipline,
      progressRate,
      competitionParticipation,
      healthScore,
      status,
      totalStudents: children.length,
      activeStudents: children.length,
      churnedThisMonth: churnedChildren,
      newThisMonth: children.filter(c => new Date((c as any).createdAt) >= monthStart).length,
      avgAttendancePercent: attendanceRate,
      paidOnTime,
      overduePayments: overdue,
      calculatedAt: new Date(),
    };

    await this.groupHealthModel.updateOne(
      { groupId },
      { $set: healthData },
      { upsert: true }
    );

    this.logger.log(`Group ${groupId} health: ${healthScore} (${status})`);
    return healthData as GroupHealth;
  }

  async getGroupHealth(groupId: string): Promise<GroupHealth | null> {
    return this.groupHealthModel.findOne({ groupId }).lean();
  }

  async getAllGroupsHealth(tenantId?: string): Promise<GroupHealth[]> {
    const filter = tenantId ? { tenantId } : {};
    return this.groupHealthModel.find(filter).sort({ healthScore: 1 }).lean();
  }

  async getCriticalGroups(tenantId?: string): Promise<GroupHealth[]> {
    const filter = tenantId 
      ? { tenantId, status: { $in: ['WARNING', 'CRITICAL'] } }
      : { status: { $in: ['WARNING', 'CRITICAL'] } };
    return this.groupHealthModel.find(filter).sort({ healthScore: 1 }).lean();
  }

  // ==================== COACH PERFORMANCE ====================

  async calculateCoachPerformance(coachId: string): Promise<CoachPerformance> {
    const coach = await this.userModel.findById(coachId).lean();
    if (!coach || coach.role !== 'COACH') throw new Error('Coach not found');

    const groups = await this.groupModel.find({ coachId }).lean();
    const groupIds = groups.map(g => g._id.toString());

    const children = await this.childModel.find({ 
      groupId: { $in: groupIds }, 
      isActive: true 
    }).lean();
    const childIds = children.map(c => c._id.toString());

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    // Retention rate (25%)
    const churnedCount = await this.childModel.countDocuments({
      groupId: { $in: groupIds },
      isActive: false,
      updatedAt: { $gte: threeMonthsAgo },
    });
    const totalHistorical = children.length + churnedCount;
    const retentionRate = totalHistorical > 0 ? Math.round((children.length / totalHistorical) * 100) : 100;

    // Attendance rate (20%)
    const attendances = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: monthStart },
    }).lean();
    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attendanceRate = attendances.length > 0 ? Math.round((presentCount / attendances.length) * 100) : 0;

    // Results score (20%) - medals
    const totalMedals = children.reduce((sum, c) => 
      sum + (c.goldMedals || 0) + (c.silverMedals || 0) + (c.bronzeMedals || 0), 0
    );
    const goldMedals = children.reduce((sum, c) => sum + (c.goldMedals || 0), 0);
    const silverMedals = children.reduce((sum, c) => sum + (c.silverMedals || 0), 0);
    const bronzeMedals = children.reduce((sum, c) => sum + (c.bronzeMedals || 0), 0);
    const resultsScore = Math.min(100, totalMedals * 10); // 10 points per medal, max 100

    // Revenue score (15%)
    const parentIds = [...new Set(children.map(c => c.parentId))];
    const paidInvoices = await this.invoiceModel.find({
      parentId: { $in: parentIds },
      status: 'PAID',
      paidAt: { $gte: monthStart },
    }).lean();
    const monthlyRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalRevenue = (await this.invoiceModel.find({
      parentId: { $in: parentIds },
      status: 'PAID',
    }).lean()).reduce((sum, inv) => sum + inv.amount, 0);
    const revenueScore = Math.min(100, Math.round(monthlyRevenue / 100)); // 1 point per 100 UAH

    // Feedback score (10%) - placeholder
    const feedbackScore = 80; // TODO: implement parent ratings

    // Activity score (10%) - comments written
    const commentsWritten = attendances.filter(a => (a as any).coachComment).length;
    const activityScore = Math.min(100, commentsWritten * 5); // 5 points per comment

    // Calculate performance score
    const performanceScore = Math.round(
      retentionRate * 0.25 +
      attendanceRate * 0.20 +
      resultsScore * 0.20 +
      revenueScore * 0.15 +
      feedbackScore * 0.10 +
      activityScore * 0.10
    );

    // Determine rank
    let rank: string;
    if (performanceScore >= 80) rank = 'TOP';
    else if (performanceScore >= 60) rank = 'GOOD';
    else if (performanceScore >= 40) rank = 'AVERAGE';
    else rank = 'AT_RISK';

    const perfData = {
      coachId,
      tenantId: (coach as any).tenantId || '',
      retentionRate,
      attendanceRate,
      resultsScore,
      revenueScore,
      feedbackScore,
      activityScore,
      performanceScore,
      rank,
      totalStudents: children.length,
      totalGroups: groups.length,
      churnedStudents: churnedCount,
      totalMedals,
      goldMedals,
      silverMedals,
      bronzeMedals,
      monthlyRevenue,
      totalRevenue,
      avgRating: 4.5, // placeholder
      ratingsCount: 0,
      actionsCompleted: 0,
      commentsWritten,
      calculatedAt: new Date(),
    };

    await this.coachPerformanceModel.updateOne(
      { coachId },
      { $set: perfData },
      { upsert: true }
    );

    this.logger.log(`Coach ${coachId} performance: ${performanceScore} (${rank})`);
    return perfData as CoachPerformance;
  }

  async getCoachPerformance(coachId: string): Promise<CoachPerformance | null> {
    return this.coachPerformanceModel.findOne({ coachId }).lean();
  }

  async getCoachLeaderboard(tenantId?: string): Promise<CoachPerformance[]> {
    const filter = tenantId ? { tenantId } : {};
    return this.coachPerformanceModel.find(filter).sort({ performanceScore: -1 }).lean();
  }

  async getAtRiskCoaches(tenantId?: string): Promise<CoachPerformance[]> {
    const filter = tenantId 
      ? { tenantId, rank: 'AT_RISK' }
      : { rank: 'AT_RISK' };
    return this.coachPerformanceModel.find(filter).lean();
  }

  // ==================== CLUB HEALTH ====================

  async calculateClubHealth(tenantId: string): Promise<ClubHealth> {
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) throw new Error('Tenant not found');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get all club data
    const children = await this.childModel.find({ tenantId, isActive: true }).lean();
    const coaches = await this.userModel.find({ tenantId, role: 'COACH' }).lean();
    const groups = await this.groupModel.find({ tenantId }).lean();
    const locations = await this.locationModel.find({ tenantId }).lean();

    // Financial metrics
    const invoices = await this.invoiceModel.find({
      // would need tenantId on invoices, using children's parentIds
    }).lean();
    const paidInvoices = await this.invoiceModel.find({ status: 'PAID', paidAt: { $gte: monthStart } }).lean();
    const monthlyRevenue = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const totalRevenue = (await this.invoiceModel.find({ status: 'PAID' }).lean())
      .reduce((sum, inv) => sum + inv.amount, 0);
    const overdueInvoices = await this.invoiceModel.find({ status: 'OVERDUE' }).lean();
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    const paymentDiscipline = invoices.length > 0 
      ? Math.round((paidInvoices.length / invoices.length) * 100) : 100;

    // Student metrics
    const newThisMonth = children.filter(c => new Date((c as any).createdAt) >= monthStart).length;
    const churnedThisMonth = await this.childModel.countDocuments({
      tenantId,
      isActive: false,
      updatedAt: { $gte: monthStart },
    });
    const churnRate = children.length > 0 ? Math.round((churnedThisMonth / children.length) * 100) : 0;
    const retentionRate = 100 - churnRate;

    // Attendance
    const childIds = children.map(c => c._id.toString());
    const attendances = await this.attendanceModel.find({
      childId: { $in: childIds },
      date: { $gte: monthStart },
    }).lean();
    const presentCount = attendances.filter(a => a.status === 'PRESENT').length;
    const avgAttendance = attendances.length > 0 ? Math.round((presentCount / attendances.length) * 100) : 0;

    // Coach metrics
    const coachPerfs = await this.coachPerformanceModel.find({ tenantId }).lean();
    const avgCoachScore = coachPerfs.length > 0 
      ? Math.round(coachPerfs.reduce((sum, cp) => sum + cp.performanceScore, 0) / coachPerfs.length) : 0;
    const topCoaches = coachPerfs.filter(cp => cp.rank === 'TOP').length;
    const atRiskCoaches = coachPerfs.filter(cp => cp.rank === 'AT_RISK').length;

    // Group metrics
    const groupHealths = await this.groupHealthModel.find({ tenantId }).lean();
    const avgGroupFillRate = groups.length > 0 
      ? Math.round(children.length / (groups.length * 15) * 100) : 0; // assume 15 per group
    const criticalGroups = groupHealths.filter(gh => gh.status === 'CRITICAL').length;

    // Calculate health score
    const healthScore = Math.round(
      retentionRate * 0.25 +
      avgAttendance * 0.25 +
      paymentDiscipline * 0.25 +
      avgCoachScore * 0.25
    );

    let status: string;
    if (healthScore >= 80) status = 'EXCELLENT';
    else if (healthScore >= 60) status = 'GOOD';
    else if (healthScore >= 40) status = 'WARNING';
    else status = 'CRITICAL';

    const clubData = {
      tenantId,
      healthScore,
      status,
      monthlyRevenue,
      totalRevenue,
      avgRevenuePerStudent: children.length > 0 ? Math.round(monthlyRevenue / children.length) : 0,
      paymentDiscipline,
      overdueAmount,
      totalStudents: children.length,
      activeStudents: children.length,
      newThisMonth,
      churnedThisMonth,
      churnRate,
      retentionRate,
      avgAttendance,
      totalCoaches: coaches.length,
      avgCoachScore,
      topCoaches,
      atRiskCoaches,
      totalGroups: groups.length,
      avgGroupFillRate,
      criticalGroups,
      totalMedals: children.reduce((sum, c) => sum + (c.goldMedals || 0) + (c.silverMedals || 0) + (c.bronzeMedals || 0), 0),
      competitionParticipation: 0,
      totalLocations: locations.length,
      calculatedAt: new Date(),
    };

    await this.clubHealthModel.updateOne(
      { tenantId },
      { $set: clubData },
      { upsert: true }
    );

    this.logger.log(`Club ${tenantId} health: ${healthScore} (${status})`);
    return clubData as ClubHealth;
  }

  async getClubHealth(tenantId: string): Promise<ClubHealth | null> {
    return this.clubHealthModel.findOne({ tenantId }).lean();
  }

  async getAllClubsHealth(): Promise<ClubHealth[]> {
    return this.clubHealthModel.find().sort({ healthScore: -1 }).lean();
  }

  // ==================== SUPER ADMIN OVERVIEW ====================

  async getSuperAdminOverview() {
    const tenants = await this.tenantModel.find({ isActive: true }).lean();
    const clubHealths = await this.clubHealthModel.find().lean();
    
    const totalStudents = clubHealths.reduce((sum, ch) => sum + ch.totalStudents, 0);
    const totalRevenue = clubHealths.reduce((sum, ch) => sum + ch.totalRevenue, 0);
    const monthlyRevenue = clubHealths.reduce((sum, ch) => sum + ch.monthlyRevenue, 0);
    const avgHealthScore = clubHealths.length > 0 
      ? Math.round(clubHealths.reduce((sum, ch) => sum + ch.healthScore, 0) / clubHealths.length) : 0;

    const byStatus = {
      EXCELLENT: clubHealths.filter(ch => ch.status === 'EXCELLENT').length,
      GOOD: clubHealths.filter(ch => ch.status === 'GOOD').length,
      WARNING: clubHealths.filter(ch => ch.status === 'WARNING').length,
      CRITICAL: clubHealths.filter(ch => ch.status === 'CRITICAL').length,
    };

    return {
      totalClubs: tenants.length,
      totalStudents,
      totalRevenue,
      monthlyRevenue,
      avgHealthScore,
      byStatus,
      topClubs: clubHealths.sort((a, b) => b.healthScore - a.healthScore).slice(0, 5),
      criticalClubs: clubHealths.filter(ch => ch.status === 'CRITICAL'),
    };
  }

  // ==================== RECALCULATE ALL ====================

  async recalculateAll() {
    this.logger.log('Starting full recalculation...');

    // Recalculate all groups
    const groups = await this.groupModel.find().lean();
    for (const group of groups) {
      try {
        await this.calculateGroupHealth(group._id.toString());
      } catch (e) {
        this.logger.error(`Failed to calculate group ${group._id}: ${e.message}`);
      }
    }

    // Recalculate all coaches
    const coaches = await this.userModel.find({ role: 'COACH' }).lean();
    for (const coach of coaches) {
      try {
        await this.calculateCoachPerformance(coach._id.toString());
      } catch (e) {
        this.logger.error(`Failed to calculate coach ${coach._id}: ${e.message}`);
      }
    }

    // Recalculate all clubs
    const tenants = await this.tenantModel.find().lean();
    for (const tenant of tenants) {
      try {
        await this.calculateClubHealth(tenant._id.toString());
      } catch (e) {
        this.logger.error(`Failed to calculate club ${tenant._id}: ${e.message}`);
      }
    }

    this.logger.log('Full recalculation completed');
    return { groups: groups.length, coaches: coaches.length, clubs: tenants.length };
  }
}
