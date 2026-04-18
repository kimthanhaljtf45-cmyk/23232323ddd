import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { ProgressService } from '../progress/progress.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MarkAttendanceDto, ReportAbsenceDto } from './dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
    private readonly progressService: ProgressService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async mark(dto: MarkAttendanceDto, userId?: string) {
    const record = await this.attendanceModel.findOneAndUpdate(
      {
        childId: dto.childId,
        scheduleId: dto.scheduleId,
        date: dto.date,
      },
      {
        ...dto,
        markedBy: userId,
      },
      { new: true, upsert: true },
    );

    // Recalculate progress
    await this.progressService.recalculateChildProgress(dto.childId);

    // If absent, notify parent
    if (dto.status === 'ABSENT') {
      await this.notificationsService.notifyAbsence(dto.childId, dto.date);
    }

    return {
      message: 'Attendance marked',
      status: dto.status,
      record: {
        id: record._id.toString(),
        ...dto,
      },
    };
  }

  async reportAbsence(dto: ReportAbsenceDto, userId: string) {
    const record = await this.attendanceModel.findOneAndUpdate(
      {
        childId: dto.childId,
        scheduleId: dto.scheduleId,
        date: dto.date,
      },
      {
        childId: dto.childId,
        scheduleId: dto.scheduleId,
        date: dto.date,
        status: 'WARNED',
        reason: dto.reason,
        comment: dto.comment,
        markedBy: userId,
      },
      { new: true, upsert: true },
    );

    return {
      message: 'Відсутність зафіксовано',
      record: {
        id: record._id.toString(),
        childId: dto.childId,
        date: dto.date,
        status: 'WARNED',
      },
    };
  }

  async getForChild(childId: string) {
    const records = await this.attendanceModel
      .find({ childId })
      .sort({ date: -1 })
      .limit(100);

    return records.map((r) => ({
      id: r._id.toString(),
      childId: r.childId,
      scheduleId: r.scheduleId,
      date: r.date,
      status: r.status,
      reason: r.reason,
      comment: r.comment,
    }));
  }
}
