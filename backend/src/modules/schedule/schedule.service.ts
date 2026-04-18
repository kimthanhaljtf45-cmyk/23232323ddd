import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Schedule, ScheduleDocument } from '../../schemas/schedule.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(Schedule.name) private readonly scheduleModel: Model<ScheduleDocument>,
    @InjectModel(Group.name) private readonly groupModel: Model<GroupDocument>,
    @InjectModel(Location.name) private readonly locationModel: Model<LocationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Child.name) private readonly childModel: Model<ChildDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async getCoachTodaySchedule(coachId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay() || 7; // 1 = Monday, 7 = Sunday
    
    // Find groups where this coach is assigned
    const groups = await this.groupModel.find({ coachId }).lean();
    const groupIds = groups.map(g => g._id.toString());
    
    // Find schedules for today
    const schedules = await this.scheduleModel.find({
      groupId: { $in: groupIds },
      dayOfWeek,
      isActive: true,
    }).lean();
    
    const result = [];
    for (const schedule of schedules) {
      const group = groups.find(g => g._id.toString() === schedule.groupId);
      const childrenCount = await this.childModel.countDocuments({ 
        groupId: schedule.groupId, 
        status: 'ACTIVE' 
      });
      
      let location = null;
      if (group?.locationId) {
        location = await this.locationModel.findById(group.locationId).lean();
      }
      
      result.push({
        id: schedule._id.toString(),
        groupId: schedule.groupId,
        groupName: group?.name || 'Група',
        time: `${schedule.startTime} - ${schedule.endTime}`,
        location: location?.name || '',
        address: location?.address || '',
        childrenCount,
        dayOfWeek: schedule.dayOfWeek,
      });
    }
    
    // Sort by start time
    result.sort((a, b) => a.time.localeCompare(b.time));
    
    return { schedules: result, date: today.toISOString().split('T')[0] };
  }

  async getUpcomingSchedule(userId: string, role: string) {
    // For parent - get schedules for their children's groups
    // For coach - get schedules for their groups
    const today = new Date();
    const dayOfWeek = today.getDay() || 7;
    
    let groupIds: string[] = [];
    
    if (role === 'COACH') {
      const groups = await this.groupModel.find({ coachId: userId }).lean();
      groupIds = groups.map(g => g._id.toString());
    } else if (role === 'PARENT') {
      // Find children linked to parent
      const children = await this.childModel.find({ }).lean(); // TODO: filter by parent
      groupIds = [...new Set(children.map(c => c.groupId).filter(Boolean))];
    }
    
    const schedules = await this.scheduleModel.find({
      groupId: { $in: groupIds },
      isActive: true,
    }).lean();
    
    return schedules.map(s => this.serialize(s));
  }

  async getGroupSchedule(groupId: string) {
    const schedules = await this.scheduleModel.find({
      groupId,
      isActive: true,
    }).sort({ dayOfWeek: 1, startTime: 1 }).lean();
    
    return schedules.map(s => this.serialize(s));
  }

  async getSchedulesForGroups(groupIds: string[]) {
    const schedules = await this.scheduleModel.find({
      groupId: { $in: groupIds },
      isActive: true,
    });

    const result = [];
    for (const schedule of schedules) {
      const scheduleData = this.serialize(schedule);
      const group = await this.groupModel.findById(schedule.groupId);
      scheduleData.group = this.serialize(group);

      if (group?.locationId) {
        const location = await this.locationModel.findById(group.locationId);
        scheduleData.location = this.serialize(location);
      }
      if (group?.coachId) {
        const coach = await this.userModel.findById(group.coachId);
        scheduleData.coach = this.serialize(coach);
      }

      result.push(scheduleData);
    }

    return result;
  }

  async findAll() {
    const schedules = await this.scheduleModel.find({ isActive: true });
    const result = [];

    for (const schedule of schedules) {
      const scheduleData = this.serialize(schedule);
      const group = await this.groupModel.findById(schedule.groupId);
      scheduleData.group = this.serialize(group);

      if (group?.locationId) {
        const location = await this.locationModel.findById(group.locationId);
        scheduleData.location = this.serialize(location);
      }

      result.push(scheduleData);
    }

    return result;
  }
}
