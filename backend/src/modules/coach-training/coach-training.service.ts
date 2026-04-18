import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TrainingSession,
  TrainingSessionDocument,
} from '../../schemas/training-session.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';

@Injectable()
export class CoachTrainingService {
  private readonly logger = new Logger('CoachTraining');

  constructor(
    @InjectModel(TrainingSession.name)
    private readonly sessionModel: Model<TrainingSessionDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,
    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
  ) {}

  /**
   * Get today's training sessions (auto-create from schedule if needed)
   */
  async getTodaySessions(coachId: string) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    return this.getSessionsByDate(coachId, dateStr);
  }

  /**
   * Get sessions for a specific date, auto-creating from group schedules
   */
  async getSessionsByDate(coachId: string, date: string) {
    const groups = await this.groupModel
      .find({ coachId, isActive: true })
      .lean();

    const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sun
    const dayMap: Record<number, string> = {
      0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
    };
    const dayName = dayMap[dayOfWeek];

    const sessions = [];

    for (const group of groups) {
      // Check if group has training on this day
      const scheduleMatch = group.schedule?.find(
        (s) => s.day === dayName || s.day === String(dayOfWeek === 0 ? 7 : dayOfWeek),
      );

      if (!scheduleMatch) continue;

      // Ensure session exists
      let session = await this.sessionModel
        .findOne({ groupId: group._id.toString(), date })
        .lean();

      if (!session) {
        // Auto-create from schedule
        const students = await this.childModel
          .find({ groupId: group._id.toString(), isActive: true })
          .lean();

        session = await this.sessionModel.create({
          groupId: group._id.toString(),
          coachId,
          date,
          startTime: scheduleMatch.time || '18:00',
          endTime: this.addHour(scheduleMatch.time || '18:00'),
          status: 'PLANNED',
          totalStudents: students.length,
        });
        session = (session as any).toObject();
      }

      // Get location
      let location = null;
      if (group.locationId) {
        location = await this.locationModel.findById(group.locationId).lean();
      }

      // Get attendance count
      const attendanceRecords = await this.attendanceModel
        .find({ scheduleId: session!._id!.toString(), date })
        .lean();

      const presentCount = attendanceRecords.filter(
        (a) => a.status === 'PRESENT' || a.status === 'LATE',
      ).length;
      const absentCount = attendanceRecords.filter(
        (a) => a.status === 'ABSENT',
      ).length;

      sessions.push({
        id: session!._id!.toString(),
        groupId: group._id.toString(),
        groupName: group.name,
        ageRange: group.ageRange,
        level: group.level,
        date,
        startTime: session!.startTime,
        endTime: session!.endTime,
        status: session!.status,
        location: location
          ? { name: location.name, address: location.address }
          : null,
        totalStudents: session!.totalStudents || 0,
        presentCount,
        absentCount,
        unmarkedCount:
          (session!.totalStudents || 0) - presentCount - absentCount,
      });
    }

    // Sort by time
    sessions.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { date, sessions };
  }

  /**
   * Ensure a session exists for group+date
   */
  async ensureSession(coachId: string, groupId: string, date: string) {
    const group = await this.groupModel
      .findOne({ _id: groupId, coachId })
      .lean();
    if (!group) throw new NotFoundException('Group not found');

    let session = await this.sessionModel
      .findOne({ groupId, date })
      .lean();

    if (!session) {
      const students = await this.childModel
        .find({ groupId, isActive: true })
        .lean();

      const dayOfWeek = new Date(date + 'T12:00:00').getDay();
      const dayMap: Record<number, string> = {
        0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
      };
      const dayName = dayMap[dayOfWeek];
      const scheduleMatch = group.schedule?.find((s) => s.day === dayName);

      session = await this.sessionModel.create({
        groupId,
        coachId,
        date,
        startTime: scheduleMatch?.time || '18:00',
        endTime: this.addHour(scheduleMatch?.time || '18:00'),
        status: 'PLANNED',
        totalStudents: students.length,
      });
      session = (session as any).toObject();
    }

    return this.getSession(coachId, session!._id!.toString());
  }

  /**
   * Get full session with students and attendance records
   */
  async getSession(coachId: string, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean();
    if (!session) throw new NotFoundException('Session not found');
    if (session.coachId !== coachId)
      throw new BadRequestException('Access denied');

    const group = await this.groupModel
      .findById(session.groupId)
      .lean();
    if (!group) throw new NotFoundException('Group not found');

    // Get students in this group
    const students = await this.childModel
      .find({ groupId: session.groupId, isActive: true })
      .lean();

    // Get attendance records for this session
    const attendanceRecords = await this.attendanceModel
      .find({ scheduleId: sessionId, date: session.date })
      .lean();

    const attendanceMap = new Map(
      attendanceRecords.map((a) => [a.childId, a]),
    );

    // Get location
    let location = null;
    if (group.locationId) {
      location = await this.locationModel.findById(group.locationId).lean();
    }

    // Calculate student-level stats (historical attendance)
    const studentList = await Promise.all(
      students.map(async (student) => {
        const history = await this.attendanceModel
          .find({ childId: student._id.toString() })
          .sort({ date: -1 })
          .limit(20)
          .lean();

        const totalSessions = history.length;
        const presentSessions = history.filter(
          (h) => h.status === 'PRESENT' || h.status === 'LATE',
        ).length;
        const attendanceRate =
          totalSessions > 0
            ? Math.round((presentSessions / totalSessions) * 100)
            : 100;

        // Consecutive absences
        let streak = 0;
        for (const h of history) {
          if (h.status === 'ABSENT') streak++;
          else break;
        }

        const currentAttendance = attendanceMap.get(
          student._id.toString(),
        );

        return {
          id: student._id.toString(),
          firstName: student.firstName,
          lastName: student.lastName || '',
          belt: student.belt || 'WHITE',
          attendanceRate,
          consecutiveAbsences: streak,
          riskLevel:
            streak >= 3
              ? 'HIGH'
              : streak >= 2 || attendanceRate < 60
                ? 'MEDIUM'
                : 'LOW',
          currentStatus: currentAttendance?.status || null,
          currentNote: currentAttendance?.comment || null,
        };
      }),
    );

    // Sort: unmarked first, then by risk level
    const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    studentList.sort((a, b) => {
      if (!a.currentStatus && b.currentStatus) return -1;
      if (a.currentStatus && !b.currentStatus) return 1;
      return (
        (riskOrder[a.riskLevel] || 2) - (riskOrder[b.riskLevel] || 2)
      );
    });

    const presentCount = studentList.filter(
      (s) => s.currentStatus === 'PRESENT' || s.currentStatus === 'LATE',
    ).length;
    const absentCount = studentList.filter(
      (s) => s.currentStatus === 'ABSENT',
    ).length;
    const unmarkedCount = studentList.filter(
      (s) => !s.currentStatus,
    ).length;

    return {
      id: session._id.toString(),
      groupId: session.groupId,
      groupName: group.name,
      ageRange: group.ageRange,
      level: group.level,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      actualStartTime: session.actualStartTime,
      actualEndTime: session.actualEndTime,
      notes: session.notes,
      location: location
        ? { name: location.name, address: location.address }
        : null,
      students: studentList,
      summary: {
        total: studentList.length,
        present: presentCount,
        absent: absentCount,
        unmarked: unmarkedCount,
        attendanceRate:
          studentList.length > 0
            ? Math.round(
                (presentCount / studentList.length) * 100,
              )
            : 0,
      },
    };
  }

  /**
   * Start a training session
   */
  async startSession(coachId: string, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.coachId !== coachId)
      throw new BadRequestException('Access denied');
    if (session.status !== 'PLANNED')
      throw new BadRequestException(
        `Cannot start session with status: ${session.status}`,
      );

    session.status = 'ACTIVE';
    session.actualStartTime = new Date();
    await session.save();

    this.logger.log(`Training started: ${sessionId}`);
    return this.getSession(coachId, sessionId);
  }

  /**
   * Finish a training session
   */
  async finishSession(coachId: string, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.coachId !== coachId)
      throw new BadRequestException('Access denied');
    if (session.status !== 'ACTIVE')
      throw new BadRequestException(
        `Cannot finish session with status: ${session.status}`,
      );

    // Count attendance
    const attendanceRecords = await this.attendanceModel
      .find({ scheduleId: sessionId, date: session.date })
      .lean();

    session.status = 'COMPLETED';
    session.actualEndTime = new Date();
    session.presentCount = attendanceRecords.filter(
      (a) => a.status === 'PRESENT' || a.status === 'LATE',
    ).length;
    session.absentCount = attendanceRecords.filter(
      (a) => a.status === 'ABSENT',
    ).length;
    await session.save();

    this.logger.log(
      `Training finished: ${sessionId}, present: ${session.presentCount}/${session.totalStudents}`,
    );
    return this.getSession(coachId, sessionId);
  }

  /**
   * Mark individual attendance
   */
  async markAttendance(
    coachId: string,
    sessionId: string,
    body: { studentId: string; status: string; note?: string },
  ) {
    const session = await this.sessionModel.findById(sessionId).lean();
    if (!session) throw new NotFoundException('Session not found');
    if (session.coachId !== coachId)
      throw new BadRequestException('Access denied');

    // Upsert attendance record
    await this.attendanceModel.findOneAndUpdate(
      {
        childId: body.studentId,
        scheduleId: sessionId,
        date: session.date,
      },
      {
        childId: body.studentId,
        scheduleId: sessionId,
        date: session.date,
        status: body.status as any,
        comment: body.note,
        markedBy: coachId,
      },
      { upsert: true, new: true },
    );

    this.logger.log(
      `Attendance: student=${body.studentId} status=${body.status} session=${sessionId}`,
    );

    return { success: true, studentId: body.studentId, status: body.status };
  }

  /**
   * Mark all unmarked students as PRESENT
   */
  async markAllPresent(coachId: string, sessionId: string) {
    const session = await this.sessionModel.findById(sessionId).lean();
    if (!session) throw new NotFoundException('Session not found');
    if (session.coachId !== coachId)
      throw new BadRequestException('Access denied');

    const students = await this.childModel
      .find({ groupId: session.groupId, isActive: true })
      .lean();

    const existingRecords = await this.attendanceModel
      .find({ scheduleId: sessionId, date: session.date })
      .lean();
    const markedIds = new Set(existingRecords.map((r) => r.childId));

    let markedCount = 0;
    for (const student of students) {
      if (!markedIds.has(student._id.toString())) {
        await this.attendanceModel.create({
          childId: student._id.toString(),
          scheduleId: sessionId,
          date: session.date,
          status: 'PRESENT',
          markedBy: coachId,
        });
        markedCount++;
      }
    }

    this.logger.log(
      `Marked all present: ${markedCount} students in session ${sessionId}`,
    );
    return { success: true, markedCount };
  }

  private addHour(time: string): string {
    const [h, m] = time.split(':').map(Number);
    const newH = (h + 1) % 24;
    return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
