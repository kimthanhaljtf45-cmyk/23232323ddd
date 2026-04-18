import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AlertsService, CreateAlertDto } from './alerts.service';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Consultation, ConsultationDocument } from '../../schemas/consultation.schema';
import { AlertType, AlertSeverity } from '../../schemas/alert.schema';

@Injectable()
export class AlertsEngine {
  private readonly logger = new Logger(AlertsEngine.name);

  constructor(
    private readonly alertsService: AlertsService,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Consultation.name) private consultationModel: Model<ConsultationDocument>,
  ) {}

  // Run every 6 hours
  @Cron('0 */6 * * *')
  async runScheduled() {
    this.logger.log('Running scheduled alerts check...');
    await this.run();
  }

  async run(): Promise<{ alertsCreated: number }> {
    let alertsCreated = 0;

    try {
      alertsCreated += await this.checkAttendance();
      alertsCreated += await this.checkPayments();
      alertsCreated += await this.checkLeads();
      alertsCreated += await this.checkProgress();

      // Cleanup expired alerts
      const deleted = await this.alertsService.deleteExpired();
      if (deleted > 0) {
        this.logger.log(`Deleted ${deleted} expired alerts`);
      }

      this.logger.log(`Alerts engine completed. Created ${alertsCreated} new alerts.`);
    } catch (error) {
      this.logger.error('Alerts engine error:', error);
    }

    return { alertsCreated };
  }

  private async checkAttendance(): Promise<number> {
    let count = 0;
    const children = await this.childModel.find({ status: 'ACTIVE' }).exec();

    for (const child of children) {
      if (!child.userId) continue;

      // Get recent attendance records
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const attendances = await this.attendanceModel.find({
        childId: (child as any)._id.toString(),
        date: { $gte: thirtyDaysAgo },
      }).sort({ date: -1 }).exec();

      // Check attendance rate
      const total = attendances.length;
      const present = attendances.filter(a => a.status === 'PRESENT').length;
      const rate = total > 0 ? (present / total) * 100 : 100;

      // LOW_ATTENDANCE (< 60%)
      if (rate < 60 && total >= 4) {
        await this.createAlert({
          userId: child.userId,
          childId: (child as any)._id.toString(),
          type: 'LOW_ATTENDANCE',
          severity: 'warning',
          title: `${child.firstName}: низька відвідуваність`,
          message: `Відвідування ${Math.round(rate)}% за останній місяць`,
          meta: { attendanceRate: rate },
        });
        count++;
      }

      // Check consecutive absences
      const recentAbsences = attendances.slice(0, 5).filter(a => a.status === 'ABSENT');
      const consecutiveAbsences = this.countConsecutive(attendances, 'ABSENT');

      if (consecutiveAbsences >= 3) {
        await this.createAlert({
          userId: child.userId,
          childId: (child as any)._id.toString(),
          type: 'ABSENCE_STREAK_3',
          severity: 'critical',
          title: `${child.firstName}: критична відсутність`,
          message: `${consecutiveAbsences} пропусків поспіль`,
          meta: { consecutiveAbsences },
        });
        count++;
      } else if (consecutiveAbsences >= 2) {
        await this.createAlert({
          userId: child.userId,
          childId: (child as any)._id.toString(),
          type: 'ABSENCE_STREAK_2',
          severity: 'warning',
          title: `${child.firstName}: пропуски поспіль`,
          message: `${consecutiveAbsences} пропуски поспіль`,
          meta: { consecutiveAbsences },
        });
        count++;
      }

      // NO_VISIT_7_DAYS
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentVisit = await this.attendanceModel.findOne({
        childId: (child as any)._id.toString(),
        status: 'PRESENT',
        date: { $gte: sevenDaysAgo },
      }).exec();

      if (!recentVisit && total > 0) {
        await this.createAlert({
          userId: child.userId,
          childId: (child as any)._id.toString(),
          type: 'NO_VISIT_7_DAYS',
          severity: 'warning',
          title: `${child.firstName}: немає візитів 7+ днів`,
          message: 'Остання присутність понад 7 днів тому',
        });
        count++;
      }
    }

    return count;
  }

  private async checkPayments(): Promise<number> {
    let count = 0;

    // Get overdue invoices
    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const overdueInvoices = await this.invoiceModel.find({
      status: 'PENDING',
      dueDate: { $lt: now },
    }).exec();

    for (const invoice of overdueInvoices) {
      if (!invoice.parentId) continue;

      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue >= 7) {
        await this.createAlert({
          userId: invoice.parentId,
          childId: invoice.childId,
          type: 'PAYMENT_OVERDUE_7',
          severity: 'critical',
          title: 'Критична заборгованість',
          message: `Рахунок прострочено на ${daysOverdue} днів`,
          meta: { invoiceId: (invoice as any)._id.toString(), daysOverdue },
        });
        count++;
      } else if (daysOverdue >= 3) {
        await this.createAlert({
          userId: invoice.parentId,
          childId: invoice.childId,
          type: 'PAYMENT_OVERDUE_3',
          severity: 'warning',
          title: 'Рахунок прострочено',
          message: `Рахунок прострочено на ${daysOverdue} дні`,
          meta: { invoiceId: (invoice as any)._id.toString(), daysOverdue },
        });
        count++;
      }
    }

    return count;
  }

  private async checkLeads(): Promise<number> {
    let count = 0;

    const now = new Date();
    const oneDayAgo = new Date(now);
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Get admins to assign alerts
    const admins = await this.userModel.find({ role: 'ADMIN' }).exec();
    const adminId = admins.length > 0 ? (admins[0] as any)._id.toString() : null;

    if (!adminId) return 0;

    // LEAD_NO_CONTACT_24H - new leads not contacted in 24h
    const newLeadsNoContact = await this.consultationModel.find({
      status: 'NEW',
      createdAt: { $lt: oneDayAgo },
    }).exec();

    for (const lead of newLeadsNoContact) {
      await this.createAlert({
        userId: adminId,
        type: 'LEAD_NO_CONTACT_24H',
        severity: 'warning',
        title: `Лід не оброблено 24+ год`,
        message: `${lead.fullName}: ${lead.phone}`,
        meta: { consultationId: (lead as any)._id.toString() },
      });
      count++;
    }

    // LEAD_STUCK_3_DAYS - leads stuck in same status
    const stuckLeads = await this.consultationModel.find({
      status: { $in: ['CONTACTED', 'BOOKED_TRIAL'] },
      updatedAt: { $lt: threeDaysAgo },
    }).exec();

    for (const lead of stuckLeads) {
      await this.createAlert({
        userId: adminId,
        type: 'LEAD_STUCK_3_DAYS',
        severity: 'warning',
        title: `Лід завис 3+ дні`,
        message: `${lead.fullName}, статус: ${lead.status}`,
        meta: { consultationId: (lead as any)._id.toString(), status: lead.status },
      });
      count++;
    }

    return count;
  }

  private async checkProgress(): Promise<number> {
    let count = 0;

    const children = await this.childModel.find({ 
      status: 'ACTIVE',
      coachApprovedForNextBelt: true,
    }).exec();

    for (const child of children) {
      if (!child.userId) continue;

      await this.createAlert({
        userId: child.userId,
        childId: (child as any)._id.toString(),
        type: 'BELT_READY',
        severity: 'info',
        title: `${child.firstName}: готовий до наступного поясу!`,
        message: 'Тренер схвалив перехід на наступний пояс',
      });
      count++;
    }

    return count;
  }

  private countConsecutive(attendances: AttendanceDocument[], status: string): number {
    let count = 0;
    for (const a of attendances) {
      if (a.status === status) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  private async createAlert(dto: CreateAlertDto): Promise<void> {
    await this.alertsService.create(dto);
  }
}
