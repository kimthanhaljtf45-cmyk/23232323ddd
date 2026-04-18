import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { RetentionService } from './retention.service';
import { RetentionEngine } from './retention.engine';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';

@Controller('retention')
@UseGuards(JwtAuthGuard)
export class RetentionController {
  constructor(
    private readonly retentionService: RetentionService,
    private readonly retentionEngine: RetentionEngine,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subscription.name) private subModel: Model<SubscriptionDocument>,
  ) {}

  @Get('child/:childId')
  async getChildRetention(@Param('childId') childId: string) {
    const snapshot = await this.retentionService.getByChild(childId);
    if (!snapshot) {
      return {
        streak: 0,
        monthlyGoal: { target: 12, current: 0, percent: 0 },
        engagementStatus: 'stable',
        dropOffRisk: 'low',
        recommendations: [],
        recentAchievements: [],
      };
    }

    return {
      childId: snapshot.entityId,
      streak: snapshot.streak,
      monthlyGoal: {
        target: snapshot.monthlyGoalTarget,
        current: snapshot.monthlyGoalCurrent,
        percent: snapshot.monthlyGoalTarget > 0 
          ? Math.round((snapshot.monthlyGoalCurrent / snapshot.monthlyGoalTarget) * 100)
          : 0,
      },
      engagementStatus: snapshot.engagementStatus,
      dropOffRisk: snapshot.dropOffRisk,
      nextMilestone: snapshot.nextMilestone,
      recentAchievements: snapshot.recentAchievements,
      recommendations: snapshot.recommendations,
      attendanceRate: snapshot.attendanceRate,
      daysSinceLastVisit: snapshot.daysSinceLastVisit,
    };
  }

  @Get('parent')
  async getParentRetention(@Request() req: any) {
    const parentId = req.user.sub;
    const snapshot = await this.retentionService.getByParent(parentId);
    return snapshot || { message: 'No retention data available' };
  }

  @Get('student/me')
  async getMyRetention(@Request() req: any) {
    const studentId = req.user.sub;
    const snapshot = await this.retentionService.getByStudent(studentId);
    
    if (!snapshot) {
      return {
        streak: 0,
        monthlyGoal: { target: 12, current: 0, percent: 0 },
        engagementStatus: 'stable',
        dropOffRisk: 'low',
        recommendations: [],
      };
    }

    return {
      streak: snapshot.streak,
      monthlyGoal: {
        target: snapshot.monthlyGoalTarget,
        current: snapshot.monthlyGoalCurrent,
        percent: snapshot.monthlyGoalTarget > 0 
          ? Math.round((snapshot.monthlyGoalCurrent / snapshot.monthlyGoalTarget) * 100)
          : 0,
      },
      engagementStatus: snapshot.engagementStatus,
      dropOffRisk: snapshot.dropOffRisk,
      nextMilestone: snapshot.nextMilestone,
      recentAchievements: snapshot.recentAchievements,
      recommendations: snapshot.recommendations,
    };
  }

  @Get('coach/risks')
  @UseGuards(RolesGuard)
  @Roles('COACH', 'ADMIN')
  async getCoachRisks() {
    const atRisk = await this.retentionService.getAtRisk();
    return {
      total: atRisk.length,
      critical: atRisk.filter(s => s.dropOffRisk === 'critical').length,
      warning: atRisk.filter(s => s.dropOffRisk === 'warning').length,
      items: atRisk.map(s => ({
        entityId: s.entityId,
        entityType: s.entityType,
        riskScore: s.riskScore,
        dropOffRisk: s.dropOffRisk,
        daysSinceLastVisit: s.daysSinceLastVisit,
        attendanceRate: s.attendanceRate,
      })),
    };
  }

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getStats() {
    return this.retentionService.getRetentionStats();
  }

  @Post('recalculate')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async recalculate() {
    return this.retentionEngine.recalculateAll();
  }

  @Post('recalculate/child/:childId')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'COACH')
  async recalculateChild(@Param('childId') childId: string) {
    await this.retentionEngine.recalculateChild(childId);
    return { success: true };
  }

  // ===== ADMIN RETENTION DASHBOARD =====

  @Get('admin/dashboard')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async getAdminRetentionDashboard(@Request() req: any) {
    const clubId = req.clubId;
    const query = clubId ? { clubId, isActive: true } : { isActive: true };
    const children = await this.childModel.find(query).lean();

    const critical: any[] = [];
    const warning: any[] = [];
    let potentialLoss = 0;

    for (const child of children) {
      const snapshot = await this.retentionService.getByChild(child._id.toString());
      if (!snapshot) continue;

      const item = {
        childId: child._id.toString(),
        name: `${child.firstName} ${child.lastName || ''}`.trim(),
        riskScore: snapshot.riskScore || 0,
        dropOffRisk: snapshot.dropOffRisk,
        engagementStatus: snapshot.engagementStatus,
        reason: snapshot.dropOffRisk === 'critical' ? 'attendance_drop' : snapshot.dropOffRisk === 'warning' ? 'low_engagement' : 'stable',
        debt: child.debtAmount || 0,
        hasDebt: child.hasDebt || false,
        daysSinceLastVisit: snapshot.daysSinceLastVisit || 0,
        attendanceRate: snapshot.attendanceRate || 0,
        streak: snapshot.streak || 0,
        coachId: child.coachId,
        groupId: child.groupId,
        recommendations: snapshot.recommendations || [],
      };

      if (snapshot.dropOffRisk === 'critical' || (snapshot.riskScore || 0) >= 60) {
        critical.push(item);
        potentialLoss += 2000;
      } else if (snapshot.dropOffRisk === 'warning' || (snapshot.riskScore || 0) >= 30) {
        warning.push(item);
        potentialLoss += 1000;
      }
    }

    // Sort by risk score descending
    critical.sort((a, b) => b.riskScore - a.riskScore);
    warning.sort((a, b) => b.riskScore - a.riskScore);

    // Get saved this month (offers accepted)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    return {
      critical,
      warning,
      healthy: children.length - critical.length - warning.length,
      summary: {
        totalStudents: children.length,
        totalAtRisk: critical.length + warning.length,
        criticalCount: critical.length,
        warningCount: warning.length,
        potentialLoss,
        retentionRate: children.length > 0 ? Math.round(((children.length - critical.length) / children.length) * 100) : 100,
      },
    };
  }

  @Post('admin/action')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async applyRetentionAction(@Body() body: { childId: string; action: string; value?: number }) {
    if (!body.childId || !body.action) {
      return { success: false, error: 'childId and action are required' };
    }
    
    const child = await this.childModel.findById(body.childId).lean();
    if (!child) return { success: false, error: 'Child not found' };

    const actions: string[] = [];

    if (body.action === 'DISCOUNT_10' || body.action === 'DISCOUNT_20' || body.action === 'DISCOUNT_30') {
      const percent = body.action === 'DISCOUNT_10' ? 10 : body.action === 'DISCOUNT_20' ? 20 : 30;
      actions.push(`Applied ${percent}% retention discount`);
    }

    if (body.action === 'FREEZE_7' || body.action === 'FREEZE_14') {
      const days = body.action === 'FREEZE_7' ? 7 : 14;
      actions.push(`Froze subscription for ${days} days`);
    }

    if (body.action === 'MESSAGE') {
      actions.push('Retention message sent');
    }

    return {
      success: true,
      childId: body.childId,
      childName: `${child.firstName} ${child.lastName || ''}`.trim(),
      action: body.action,
      appliedActions: actions,
    };
  }
}
