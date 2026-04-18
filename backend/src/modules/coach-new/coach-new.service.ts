import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  CoachProfile,
  CoachProfileDocument,
} from '../../schemas/coach-profile.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';

import { CreateCoachProfileDto, UpdateCoachProfileDto } from './dto';

@Injectable()
export class CoachNewService {
  constructor(
    @InjectModel(CoachProfile.name)
    private readonly coachProfileModel: Model<CoachProfileDocument>,

    @InjectModel(Group.name)
    private readonly groupModel: Model<GroupDocument>,

    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,

    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<AttendanceDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,

    @InjectModel(Location.name)
    private readonly locationModel: Model<LocationDocument>,
  ) {}

  async createProfile(dto: CreateCoachProfileDto) {
    const existing = await this.coachProfileModel.findOne({ userId: dto.userId });
    if (existing) {
      return existing;
    }

    const profile = await this.coachProfileModel.create({
      userId: dto.userId,
      clubIds: dto.clubIds || [],
      groupIds: dto.groupIds || [],
      specialization: dto.specialization || [],
      bio: dto.bio,
    });

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateCoachProfileDto) {
    const profile = await this.coachProfileModel.findOne({ userId });
    if (!profile) throw new NotFoundException('Coach profile not found');

    Object.assign(profile, dto);
    await profile.save();

    return profile;
  }

  async getProfile(userId: string) {
    const profile = await this.coachProfileModel.findOne({ userId }).lean();
    
    // Auto-create profile if doesn't exist
    if (!profile) {
      const newProfile = await this.createProfile({ userId });
      return this.getProfile(userId);
    }

    const user = await this.userModel.findById(userId).lean();
    const groups = await this.groupModel.find({ coachId: userId, isActive: true }).lean();
    const groupIds = groups.map((g) => g._id.toString());
    const students = await this.childModel.find({ groupId: { $in: groupIds }, isActive: true }).lean();

    return {
      ...profile,
      id: profile._id.toString(),
      coach: user ? {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      } : null,
      groupsCount: groups.length,
      studentsCount: students.length,
      groups: groups.map(g => ({
        id: g._id.toString(),
        name: g.name,
        programType: g.programType,
        studentsCount: students.filter(s => s.groupId === g._id.toString()).length,
      })),
    };
  }

  async getDashboard(userId: string) {
    const coach = await this.userModel.findById(userId).lean();
    if (!coach) throw new NotFoundException('Coach not found');

    // Ensure profile exists
    let profile = await this.coachProfileModel.findOne({ userId }).lean();
    if (!profile) {
      await this.createProfile({ userId });
    }

    const groups = await this.groupModel.find({ coachId: userId, isActive: true }).lean();
    const groupIds = groups.map((g) => g._id.toString());
    const students = await this.childModel.find({
      groupId: { $in: groupIds },
      isActive: true,
    }).lean();

    // Today's schedule
    const today = new Date();
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const todayName = dayNames[today.getDay()];
    const todayStr = today.toISOString().slice(0, 10);

    // Find groups with trainings today
    const todayTrainings = [];
    for (const group of groups) {
      const todaySchedule = group.schedule?.find(s => s.day === todayName);
      if (todaySchedule) {
        const groupStudents = students.filter(s => s.groupId === group._id.toString());
        const todayAttendance = await this.attendanceModel.find({
          groupId: group._id.toString(),
          date: todayStr,
        }).lean();

        // Get location
        let location = null;
        if (group.locationId) {
          location = await this.locationModel.findById(group.locationId).lean();
        }

        todayTrainings.push({
          groupId: group._id.toString(),
          groupName: group.name,
          time: todaySchedule.time,
          location: location?.name || '',
          address: location?.address || '',
          studentsCount: groupStudents.length,
          markedCount: todayAttendance.length,
          isCompleted: todayAttendance.length === groupStudents.length,
        });
      }
    }

    // Sort by time
    todayTrainings.sort((a, b) => a.time.localeCompare(b.time));

    // At-risk students (simplified: students with low attendance)
    const atRiskStudents = [];
    for (const student of students.slice(0, 10)) {
      const attendance = await this.attendanceModel.find({
        childId: student._id.toString(),
      }).limit(12).lean();
      
      const presentCount = attendance.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = attendance.length > 0 ? presentCount / attendance.length : 1;
      
      if (attendanceRate < 0.7) {
        atRiskStudents.push({
          id: student._id.toString(),
          name: `${student.firstName} ${student.lastName || ''}`.trim(),
          reason: attendanceRate < 0.5 ? 'Низька відвідуваність' : 'Нестабільна відвідуваність',
          groupId: student.groupId,
          attendanceRate: Math.round(attendanceRate * 100),
        });
      }
    }

    // Unpaid students
    const childIds = students.map(s => s._id.toString());
    const unpaidInvoices = await this.invoiceModel.find({
      childId: { $in: childIds },
      status: { $in: ['PENDING', 'OVERDUE'] },
    }).lean();

    const unpaidStudents = [];
    for (const invoice of unpaidInvoices.slice(0, 10)) {
      const student = students.find(s => s._id.toString() === invoice.childId);
      if (student) {
        unpaidStudents.push({
          id: student._id.toString(),
          name: `${student.firstName} ${student.lastName || ''}`.trim(),
          amount: invoice.amount,
          status: invoice.status,
          dueDate: invoice.dueDate,
        });
      }
    }

    return {
      coach: {
        id: coach._id.toString(),
        name: `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || 'Тренер',
        phone: coach.phone,
        groupsCount: groups.length,
        studentsCount: students.length,
      },
      todayTrainings,
      atRiskStudents,
      unpaidStudents,
      stats: {
        totalGroups: groups.length,
        totalStudents: students.length,
        todayTrainingsCount: todayTrainings.length,
        atRiskCount: atRiskStudents.length,
        unpaidCount: unpaidStudents.length,
      },
      groups: groups.map((g) => ({
        id: g._id.toString(),
        name: g.name,
        programType: g.programType,
        studentsCount: students.filter((s) => s.groupId === g._id.toString()).length,
        schedule: g.schedule,
      })),
    };
  }

  async getGroups(userId: string): Promise<any[]> {
    const groups = await this.groupModel.find({ coachId: userId, isActive: true }).lean();
    const groupIds = groups.map((g) => g._id.toString());
    const students = await this.childModel.find({
      groupId: { $in: groupIds },
      isActive: true,
    }).lean();

    return groups.map((group) => ({
      ...group,
      id: group._id.toString(),
      studentsCount: students.filter((s) => s.groupId === group._id.toString()).length,
    }));
  }

  async getGroupDetails(userId: string, groupId: string): Promise<any> {
    const group = await this.groupModel.findOne({
      _id: groupId,
      coachId: userId,
    }).lean();

    if (!group) throw new NotFoundException('Group not found or access denied');

    const students = await this.childModel.find({
      groupId,
      isActive: true,
    }).lean();

    let location = null;
    if (group.locationId) {
      location = await this.locationModel.findById(group.locationId).lean();
    }

    return {
      ...group,
      id: group._id.toString(),
      students: students.map(s => ({
        id: s._id.toString(),
        firstName: s.firstName,
        lastName: s.lastName,
        belt: s.belt,
        programType: s.programType,
      })),
      studentsCount: students.length,
      location: location ? {
        id: location._id.toString(),
        name: location.name,
        address: location.address,
      } : null,
    };
  }

  async getStudents(userId: string) {
    const groups = await this.groupModel.find({ coachId: userId, isActive: true }).lean();
    const groupIds = groups.map((g) => g._id.toString());
    
    const students = await this.childModel.find({
      groupId: { $in: groupIds },
      isActive: true,
    }).lean();

    return students.map(s => {
      const group = groups.find(g => g._id.toString() === s.groupId);
      return {
        id: s._id.toString(),
        firstName: s.firstName,
        lastName: s.lastName,
        belt: s.belt,
        programType: s.programType,
        groupId: s.groupId,
        groupName: group?.name || '',
      };
    });
  }
}
