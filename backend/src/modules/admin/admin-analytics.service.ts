import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
  ) {}

  private getLastDays(n: number): string[] {
    const days = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    return days;
  }

  async getAnalytics() {
    const [attendanceTrend, disciplineTrend, beltGrowth, insights] = await Promise.all([
      this.getAttendanceTrend(),
      this.getDisciplineTrend(),
      this.getBeltGrowth(),
      this.generateInsights(),
    ]);

    return {
      attendanceTrend,
      disciplineTrend,
      beltGrowth,
      insights,
    };
  }

  private async getAttendanceTrend() {
    const last7Days = this.getLastDays(7);
    const result = [];

    for (const day of last7Days) {
      const records = await this.attendanceModel.find({ date: day });
      const present = records.filter((x) => x.status === 'PRESENT').length;
      const rate = records.length > 0 ? Math.round((present / records.length) * 100) : 0;
      result.push({ date: day, rate });
    }

    return result;
  }

  private async getDisciplineTrend() {
    const last7Days = this.getLastDays(7);
    const result = [];

    for (const day of last7Days) {
      const records = await this.attendanceModel.find({ date: day });
      if (records.length === 0) {
        result.push({ date: day, value: 0 });
        continue;
      }

      const present = records.filter((a) => a.status === 'PRESENT').length;
      const warned = records.filter((a) => a.status === 'WARNED').length;
      const late = records.filter((a) => a.status === 'LATE').length;

      const weighted = present * 1.0 + warned * 0.6 + late * 0.5;
      const value = Math.round((weighted / records.length) * 100);
      result.push({ date: day, value });
    }

    return result;
  }

  private async getBeltGrowth() {
    const children = await this.childModel.find({});
    const map: Record<string, number> = {};

    for (const c of children) {
      const belt = c.belt || 'WHITE';
      map[belt] = (map[belt] || 0) + 1;
    }

    return Object.entries(map).map(([belt, count]) => ({ belt, count }));
  }

  private async generateInsights() {
    const insights: Array<{ type: string; message: string; severity: string }> = [];

    // Get attendance trend
    const attendanceTrend = await this.getAttendanceTrend();
    const last3 = attendanceTrend.slice(-3);

    // Check if attendance is declining
    if (
      last3.length === 3 &&
      last3[2].rate < last3[1].rate &&
      last3[1].rate < last3[0].rate &&
      last3[0].rate > 0
    ) {
      insights.push({
        type: 'DECLINE_ATTENDANCE',
        message: 'Відвідуваність падає 3 дні поспіль',
        severity: 'critical',
      });
    }

    // Get discipline trend
    const disciplineTrend = await this.getDisciplineTrend();
    const lastDiscipline = disciplineTrend.slice(-3);

    if (
      lastDiscipline.length === 3 &&
      lastDiscipline[2].value < lastDiscipline[1].value &&
      lastDiscipline[1].value < lastDiscipline[0].value &&
      lastDiscipline[0].value > 0
    ) {
      insights.push({
        type: 'DECLINE_DISCIPLINE',
        message: 'Дисципліна погіршується',
        severity: 'warning',
      });
    }

    // Check for children at risk (2+ absences in a row)
    const children = await this.childModel.find({});
    let childrenAtRisk = 0;

    for (const child of children) {
      const recentAttendance = await this.attendanceModel
        .find({ childId: child._id.toString() })
        .sort({ date: -1 })
        .limit(2);

      if (
        recentAttendance.length === 2 &&
        recentAttendance.every((a) => a.status === 'ABSENT')
      ) {
        childrenAtRisk++;
      }
    }

    if (childrenAtRisk > 0) {
      insights.push({
        type: 'CHILDREN_AT_RISK',
        message: `${childrenAtRisk} учнів з ризиком випадіння (2+ пропуски поспіль)`,
        severity: childrenAtRisk > 5 ? 'critical' : 'warning',
      });
    }

    return insights;
  }
}
