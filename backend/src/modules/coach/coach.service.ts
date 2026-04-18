import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Schedule, ScheduleDocument } from '../../schemas/schedule.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';

@Injectable()
export class CoachService {
  constructor(
    @InjectModel(Schedule.name)
    private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async getTodaySchedules(coachId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay(); // 1-7 (Mon-Sun)
    const dateStr = today.toISOString().split('T')[0];

    // Get coach's groups
    const groups = await this.groupModel.find({ coachId });
    const groupIds = groups.map((g) => g._id.toString());

    // Get today's schedules
    const schedules = await this.scheduleModel.find({
      groupId: { $in: groupIds },
      dayOfWeek,
      isActive: true,
    });

    const result = [];
    for (const schedule of schedules) {
      const group = groups.find((g) => g._id.toString() === schedule.groupId);
      if (!group) continue;

      let location = null;
      if (group.locationId) {
        location = await this.locationModel.findById(group.locationId);
      }

      // Count children in group
      const children = await this.childModel.find({ groupId: schedule.groupId });
      const childrenCount = children.length;

      // Count marked attendance for today
      const marked = await this.attendanceModel.countDocuments({
        scheduleId: schedule._id.toString(),
        date: dateStr,
      });

      result.push({
        id: schedule._id.toString(),
        groupId: schedule.groupId,
        groupName: group.name,
        time: `${schedule.startTime} - ${schedule.endTime}`,
        location: location ? location.name : null,
        locationAddress: location ? location.address : null,
        childrenCount,
        markedCount: marked,
        date: dateStr,
      });
    }

    return { schedules: result, date: dateStr };
  }

  async getScheduleAttendance(scheduleId: string) {
    const schedule = await this.scheduleModel.findById(scheduleId);
    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const group = await this.groupModel.findById(schedule.groupId);
    let location = null;
    if (group?.locationId) {
      location = await this.locationModel.findById(group.locationId);
    }

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    // Get children in this group
    const children = await this.childModel.find({ groupId: schedule.groupId });

    // Get attendance for today
    const attendanceRecords = await this.attendanceModel.find({
      scheduleId: scheduleId,
      date: dateStr,
    });

    const attendanceMap = new Map(
      attendanceRecords.map((a) => [a.childId, a]),
    );

    const childrenData = children.map((child) => {
      const attendance = attendanceMap.get(child._id.toString());
      return {
        childId: child._id.toString(),
        childName: `${child.firstName} ${child.lastName || ''}`.trim(),
        belt: child.belt || 'WHITE',
        status: attendance?.status || null,
        comment: attendance?.comment || null,
      };
    });

    return {
      schedule: {
        id: schedule._id.toString(),
        groupId: schedule.groupId,
        groupName: group?.name,
        date: dateStr,
        time: `${schedule.startTime} - ${schedule.endTime}`,
        location: location?.name,
        locationAddress: location?.address,
      },
      children: childrenData,
    };
  }
}
