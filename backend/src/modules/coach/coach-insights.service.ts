import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';

@Injectable()
export class CoachInsightsService {
  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Child.name) private readonly childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
  ) {}

  async getInsights(coachId: string) {
    const groups = await this.groupModel.find({ coachId }).lean();
    const groupIds = groups.map((g) => g._id.toString());

    const children = await this.childModel.find({
      groupId: { $in: groupIds },
    }).lean();

    const childIds = children.map((c) => c._id.toString());

    // Build insights
    const atRiskStudents = await this.buildAtRiskStudents(children, groups);
    const beltReadyStudents = await this.buildBeltReadyStudents(children, groups);
    const groupHealth = await this.buildGroupHealth(groups, children);
    const actions = this.buildActions(atRiskStudents, beltReadyStudents);

    return {
      summary: {
        groupsCount: groups.length,
        studentsCount: children.length,
        atRiskCount: atRiskStudents.length,
        beltReadyCount: beltReadyStudents.length,
      },
      atRiskStudents,
      beltReadyStudents,
      groupHealth,
      actions,
    };
  }

  private async buildAtRiskStudents(children: any[], groups: any[]) {
    const result: any[] = [];

    for (const child of children) {
      const childId = child._id.toString();

      // Get recent attendance
      const recent = await this.attendanceModel
        .find({ childId })
        .sort({ date: -1 })
        .limit(5)
        .lean();

      const recentStatuses = recent.map((x) => x.status);

      // Check for 2+ absences in a row
      const last2 = recentStatuses.slice(0, 2);
      const has2Absents = last2.length === 2 && last2.every((x) => x === 'ABSENT');

      // Calculate discipline
      const allAttendance = await this.attendanceModel.find({ childId }).lean();
      const total = allAttendance.length;
      const present = allAttendance.filter((a) => a.status === 'PRESENT').length;
      const warned = allAttendance.filter((a) => a.status === 'WARNED').length;
      const late = allAttendance.filter((a) => a.status === 'LATE').length;

      const weighted = present * 1.0 + warned * 0.6 + late * 0.5;
      const disciplineScore = total > 0 ? Math.round((weighted / total) * 100) : 0;
      const attendancePercent = total > 0 ? Math.round((present / total) * 100) : 0;

      const disciplineLow = disciplineScore < 60;

      // Calculate trend
      let trend = 'stable';
      if (recentStatuses.length >= 3) {
        const recentPresent = recentStatuses.slice(0, 3).filter((s) => s === 'PRESENT').length;
        const olderPresent = recentStatuses.slice(3).filter((s) => s === 'PRESENT').length;
        if (recentPresent < olderPresent) trend = 'down';
        else if (recentPresent > olderPresent) trend = 'up';
      }

      const trendDown = trend === 'down';

      if (has2Absents || disciplineLow || trendDown) {
        const group = groups.find((g) => g._id.toString() === child.groupId);

        result.push({
          childId,
          childName: `${child.firstName} ${child.lastName || ''}`.trim(),
          groupId: child.groupId,
          groupName: group?.name || '—',
          belt: child.belt || 'WHITE',
          disciplineScore,
          attendancePercent,
          riskReason: has2Absents
            ? '2 пропуски поспіль'
            : disciplineLow
              ? 'Низька дисципліна'
              : 'Негативний тренд',
          trend,
        });
      }
    }

    return result;
  }

  private async buildBeltReadyStudents(children: any[], groups: any[]) {
    const result: any[] = [];

    const BELT_ORDER = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'];
    const BELT_REQUIREMENTS: Record<string, { attendance: number; months: number }> = {
      WHITE: { attendance: 0, months: 0 },
      YELLOW: { attendance: 12, months: 1 },
      ORANGE: { attendance: 20, months: 2 },
      GREEN: { attendance: 28, months: 3 },
      BLUE: { attendance: 40, months: 4 },
      BROWN: { attendance: 55, months: 6 },
      BLACK: { attendance: 80, months: 12 },
    };

    for (const child of children) {
      const childId = child._id.toString();
      const currentBelt = child.belt || 'WHITE';
      const currentIdx = BELT_ORDER.indexOf(currentBelt);
      const nextBelt = currentIdx < BELT_ORDER.length - 1 ? BELT_ORDER[currentIdx + 1] : null;

      if (!nextBelt) continue;

      // Get attendance
      const allAttendance = await this.attendanceModel.find({ childId }).lean();
      const presentCount = allAttendance.filter((a) => a.status === 'PRESENT').length;

      // Calculate requirements
      const req = BELT_REQUIREMENTS[nextBelt];
      const attendanceProgress = req.attendance > 0 ? Math.min(100, (presentCount / req.attendance) * 100) : 100;

      // Estimate months (from first attendance)
      let monthsInBelt = 0;
      if (allAttendance.length > 0) {
        const sorted = allAttendance.sort((a, b) => (a.date > b.date ? 1 : -1));
        const firstDate = new Date(sorted[0].date);
        const now = new Date();
        monthsInBelt = Math.max(0, Math.floor((now.getTime() - firstDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
      }

      const timeProgress = req.months > 0 ? Math.min(100, (monthsInBelt / req.months) * 100) : 100;

      // Combined progress
      const progressPercent = Math.round((attendanceProgress * 0.6 + timeProgress * 0.4));

      const coachApproved = child.coachApprovedForNextBelt || false;

      if (progressPercent >= 85 && !coachApproved) {
        const group = groups.find((g) => g._id.toString() === child.groupId);

        result.push({
          childId,
          childName: `${child.firstName} ${child.lastName || ''}`.trim(),
          groupId: child.groupId,
          groupName: group?.name || '—',
          currentBelt,
          nextBelt,
          progressPercent,
          coachApproved,
        });
      }
    }

    return result;
  }

  private async buildGroupHealth(groups: any[], children: any[]) {
    const result: any[] = [];

    for (const group of groups) {
      const groupId = group._id.toString();
      const groupChildren = children.filter((c) => c.groupId === groupId);
      const childIds = groupChildren.map((c) => c._id.toString());

      // Get all attendance for group
      const attendance = await this.attendanceModel.find({ childId: { $in: childIds } }).lean();
      const total = attendance.length;
      const present = attendance.filter((a) => a.status === 'PRESENT').length;
      const warned = attendance.filter((a) => a.status === 'WARNED').length;
      const late = attendance.filter((a) => a.status === 'LATE').length;

      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      const weighted = present * 1.0 + warned * 0.6 + late * 0.5;
      const disciplineAvg = total > 0 ? Math.round((weighted / total) * 100) : 0;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (disciplineAvg < 75 || attendanceRate < 75) status = 'warning';
      if (disciplineAvg < 60 || attendanceRate < 60) status = 'critical';

      result.push({
        groupId,
        groupName: group.name,
        studentsCount: groupChildren.length,
        attendanceRate,
        disciplineAvg,
        status,
      });
    }

    return result;
  }

  private buildActions(atRiskStudents: any[], beltReadyStudents: any[]) {
    const actions: any[] = [];

    // Add review actions for at-risk students
    for (const student of atRiskStudents.slice(0, 3)) {
      actions.push({
        type: 'REVIEW_CHILD',
        title: `Переглянути ${student.childName}`,
        message: student.riskReason,
        screen: '/(coach)/groups/[id]',
        params: {
          id: student.groupId,
          childId: student.childId,
        },
      });
    }

    // Add belt approval actions
    for (const student of beltReadyStudents.slice(0, 3)) {
      actions.push({
        type: 'APPROVE_BELT',
        title: `${student.childName} готовий до поясу`,
        message: `Прогрес ${student.progressPercent}%, ${student.currentBelt} → ${student.nextBelt}`,
        screen: '/(coach)/groups/[id]',
        params: {
          id: student.groupId,
          childId: student.childId,
        },
      });
    }

    return actions;
  }
}
