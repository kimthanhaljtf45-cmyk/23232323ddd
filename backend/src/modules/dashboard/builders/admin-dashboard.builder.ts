import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../../schemas/user.schema';
import { Child, ChildDocument } from '../../../schemas/child.schema';
import { Group, GroupDocument } from '../../../schemas/group.schema';
import { Invoice, InvoiceDocument } from '../../../schemas/invoice.schema';
import { Attendance, AttendanceDocument } from '../../../schemas/attendance.schema';
import { DashboardBlock } from '../dashboard-blocks.service';

/**
 * Admin Dashboard Builder
 * Shows: KPIs, attendance health, discipline index, revenue, alerts
 */
@Injectable()
export class AdminDashboardBuilder {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  async build(user: any) {
    // Get overall stats
    const totalStudents = await this.childModel.countDocuments();
    const totalGroups = await this.groupModel.countDocuments();
    const totalCoaches = await this.userModel.countDocuments({ role: 'COACH' });
    const totalParents = await this.userModel.countDocuments({ role: 'PARENT' });

    // Get invoice stats
    const pendingInvoices = await this.invoiceModel.find({ status: 'PENDING' });
    const overdueInvoices = await this.invoiceModel.find({ status: 'OVERDUE' });
    const paidInvoices = await this.invoiceModel.find({ status: 'PAID' });

    const pendingAmount = pendingInvoices.reduce((sum, i) => sum + i.amount, 0);
    const overdueAmount = overdueInvoices.reduce((sum, i) => sum + i.amount, 0);
    const paidAmount = paidInvoices.reduce((sum, i) => sum + i.amount, 0);

    // Calculate attendance health
    const attendanceHealth = await this.calculateAttendanceHealth();

    // Calculate discipline index
    const disciplineIndex = await this.calculateDisciplineIndex();

    // Get open alerts
    const openAlerts = await this.getOpenAlerts();

    // Get group issues
    const groupIssues = await this.getGroupIssues();

    // Build blocks
    const blocks: DashboardBlock[] = [];

    // 1. Open Alerts Block
    if (openAlerts.length > 0) {
      blocks.push({
        type: 'OPEN_ALERTS',
        priority: 1,
        items: openAlerts,
      });
    }

    // 2. KPI Block
    blocks.push({
      type: 'KPI',
      priority: 2,
      items: [
        { label: 'Учнів', value: totalStudents, icon: 'people-outline' },
        { label: 'Груп', value: totalGroups, icon: 'grid-outline' },
        { label: 'Тренерів', value: totalCoaches, icon: 'fitness-outline' },
        { label: 'Батьків', value: totalParents, icon: 'home-outline' },
      ],
    });

    // 3. Attendance Health Block
    blocks.push({
      type: 'ATTENDANCE_HEALTH',
      priority: 3,
      items: [{
        overallPercent: attendanceHealth.overall,
        status: attendanceHealth.overall >= 70 ? 'good' : attendanceHealth.overall >= 50 ? 'warning' : 'critical',
        trend: attendanceHealth.trend,
        message: attendanceHealth.overall >= 70 ? 'Відвідуваність в нормі' : 'Потребує уваги',
      }],
    });

    // 4. Discipline Index Block
    blocks.push({
      type: 'DISCIPLINE_INDEX',
      priority: 4,
      items: [{
        value: disciplineIndex,
        maxValue: 100,
        status: disciplineIndex >= 70 ? 'good' : disciplineIndex >= 50 ? 'warning' : 'critical',
      }],
    });

    // 5. Revenue Block
    blocks.push({
      type: 'REVENUE',
      priority: 5,
      items: [
        { label: 'Оплачено', amount: paidAmount, currency: 'UAH', status: 'paid' },
        { label: 'Очікує', amount: pendingAmount, currency: 'UAH', status: 'pending' },
        { label: 'Прострочено', amount: overdueAmount, currency: 'UAH', status: 'overdue' },
      ],
    });

    // 6. Group Issues Block
    if (groupIssues.length > 0) {
      blocks.push({
        type: 'GROUP_ISSUES',
        priority: 6,
        items: groupIssues,
      });
    }

    // 7. Billing Overview Block
    blocks.push({
      type: 'BILLING_OVERVIEW',
      priority: 7,
      items: [
        { label: 'Очікує оплати', count: pendingInvoices.length },
        { label: 'Прострочено', count: overdueInvoices.length },
        { label: 'Оплачено цього місяця', count: paidInvoices.length },
      ],
    });

    // 8. Quick Actions Block
    blocks.push({
      type: 'QUICK_ACTIONS',
      priority: 8,
      items: [
        { title: 'Повідомлення', icon: 'megaphone-outline', screen: '/(tabs)/feed' },
        { title: 'Білінг', icon: 'card-outline', screen: '/payments' },
        { title: 'Групи', icon: 'people-outline', screen: '/(tabs)/schedule' },
      ],
    });

    return {
      role: 'ADMIN',
      programType: 'ADMIN',
      header: {
        title: 'Панель адміністратора',
        subtitle: `${totalStudents} учнів у ${totalGroups} групах`,
      },
      state: {
        totalStudents,
        totalGroups,
        pendingPaymentsCount: pendingInvoices.length,
        overduePaymentsCount: overdueInvoices.length,
        hasAlerts: openAlerts.length > 0,
      },
      blocks: blocks.sort((a, b) => a.priority - b.priority),
    };
  }

  private async calculateAttendanceHealth() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const attendances = await this.attendanceModel.find({
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    });

    const total = attendances.length || 1;
    const present = attendances.filter(a => a.status === 'PRESENT').length;
    const overall = Math.round((present / total) * 100);

    return {
      overall,
      trend: 'stable' as 'up' | 'down' | 'stable',
    };
  }

  private async calculateDisciplineIndex(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const attendances = await this.attendanceModel.find({
      date: { $gte: startOfMonth.toISOString().split('T')[0] },
    });

    const total = attendances.length || 1;
    const absent = attendances.filter(a => a.status === 'ABSENT').length;
    const warned = attendances.filter(a => a.status === 'WARNED').length;

    const absentRate = (absent / total) * 100;
    const warnedRate = (warned / total) * 100;

    // Discipline index: 100 - penalties
    const index = 100 - (absentRate * 1.5) - (warnedRate * 0.5);
    return Math.max(0, Math.round(index));
  }

  private async getOpenAlerts() {
    const alerts: any[] = [];

    // Check for overdue invoices
    const overdueCount = await this.invoiceModel.countDocuments({ status: 'OVERDUE' });
    if (overdueCount > 0) {
      alerts.push({
        type: 'OVERDUE_PAYMENTS',
        title: 'Прострочені оплати',
        message: `${overdueCount} рахунків прострочено`,
        severity: 'critical',
        screen: '/payments',
      });
    }

    // Check for low attendance groups
    const groups = await this.groupModel.find();
    let lowAttendanceGroups = 0;

    for (const group of groups) {
      const children = await this.childModel.find({ groupId: group._id.toString() });
      if (children.length === 0) continue;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      let totalAttendance = 0;
      for (const child of children) {
        const attendances = await this.attendanceModel.find({
          childId: child._id.toString(),
          date: { $gte: startOfMonth.toISOString().split('T')[0] },
        });
        const present = attendances.filter(a => a.status === 'PRESENT').length;
        const total = attendances.length || 1;
        totalAttendance += (present / total) * 100;
      }

      if (totalAttendance / children.length < 50) {
        lowAttendanceGroups++;
      }
    }

    if (lowAttendanceGroups > 0) {
      alerts.push({
        type: 'LOW_ATTENDANCE_GROUPS',
        title: 'Низька відвідуваність',
        message: `${lowAttendanceGroups} груп з низькою відвідуваністю`,
        severity: 'warning',
      });
    }

    return alerts;
  }

  private async getGroupIssues() {
    const issues: any[] = [];
    const groups = await this.groupModel.find().populate('coachId').populate('locationId');

    for (const group of groups) {
      const children = await this.childModel.find({ groupId: group._id.toString() });
      
      // Check capacity
      if (children.length >= (group.capacity || 15)) {
        issues.push({
          groupId: group._id.toString(),
          groupName: group.name,
          type: 'FULL_CAPACITY',
          message: `Група заповнена (${children.length}/${group.capacity || 15})`,
        });
      }
    }

    return issues;
  }
}
