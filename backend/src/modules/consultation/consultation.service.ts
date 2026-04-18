import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import {
  Consultation,
  ConsultationDocument,
} from '../../schemas/consultation.schema';
import { CreateConsultationDto } from './dto/create-consultation.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';
import { AssignConsultationDto } from './dto/assign-consultation.dto';
import { ConvertConsultationDto } from './dto/convert-consultation.dto';
import { User, UserDocument } from '../../schemas/user.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';

@Injectable()
export class ConsultationService {
  constructor(
    @InjectModel(Consultation.name)
    private readonly consultationModel: Model<ConsultationDocument>,

    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,

    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,

    @InjectModel(ParentChild.name)
    private readonly parentChildModel: Model<ParentChildDocument>,
  ) {}

  async create(dto: CreateConsultationDto, userId?: string) {
    const lead = await this.consultationModel.create({
      ...dto,
      userId,
      status: 'NEW',
    });

    return lead;
  }

  async getBoard() {
    const items = await this.consultationModel.find().sort({ createdAt: -1 }).lean();

    const columns = ['NEW', 'CONTACTED', 'BOOKED_TRIAL', 'TRIAL_DONE', 'CONVERTED', 'LOST']
      .map((status) => ({
        status,
        label: this.getStatusLabel(status),
        items: items.filter((x) => x.status === status),
        count: items.filter((x) => x.status === status).length,
      }));

    const stats = {
      total: items.length,
      newCount: items.filter(x => x.status === 'NEW').length,
      contactedCount: items.filter(x => x.status === 'CONTACTED').length,
      bookedCount: items.filter(x => x.status === 'BOOKED_TRIAL').length,
      trialDoneCount: items.filter(x => x.status === 'TRIAL_DONE').length,
      convertedCount: items.filter(x => x.status === 'CONVERTED').length,
      lostCount: items.filter(x => x.status === 'LOST').length,
      conversionRate: items.length > 0 
        ? Math.round((items.filter(x => x.status === 'CONVERTED').length / items.length) * 100) 
        : 0,
    };

    return { columns, stats };
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'NEW': 'Нові',
      'CONTACTED': "Зв'язались",
      'BOOKED_TRIAL': 'Записані на пробне',
      'TRIAL_DONE': 'Пробне пройшло',
      'CONVERTED': 'Конвертовані',
      'LOST': 'Втрачені',
    };
    return labels[status] || status;
  }

  async getList(query?: { status?: string; assignedToAdminId?: string; programType?: string }) {
    const filter: any = {};

    if (query?.status) filter.status = query.status;
    if (query?.assignedToAdminId) filter.assignedToAdminId = query.assignedToAdminId;
    if (query?.programType) filter.programType = query.programType;

    return this.consultationModel.find(filter).sort({ createdAt: -1 });
  }

  async getById(id: string) {
    const item = await this.consultationModel.findById(id);
    if (!item) throw new NotFoundException('Consultation not found');
    return item;
  }

  async assign(id: string, dto: AssignConsultationDto) {
    const item = await this.getById(id);

    item.assignedToAdminId = dto.assignedToAdminId ?? item.assignedToAdminId;
    item.assignedCoachId = dto.assignedCoachId ?? item.assignedCoachId;

    await item.save();
    return item;
  }

  async updateStatus(id: string, dto: UpdateConsultationStatusDto) {
    const item = await this.getById(id);

    item.status = dto.status;

    if (dto.status === 'CONTACTED') {
      item.contactedAt = new Date();
    }

    if (dto.trialDate) {
      item.trialDate = dto.trialDate;
    }

    if (dto.trialLocationId) {
      item.trialLocationId = dto.trialLocationId;
    }

    if (dto.status === 'LOST' && dto.lostReason) {
      item.lostReason = dto.lostReason;
    }

    await item.save();
    return item;
  }

  async convert(id: string, dto: ConvertConsultationDto) {
    const item = await this.getById(id);

    let userId = item.userId;

    // Create user if not exists
    if (!userId) {
      const user = await this.userModel.create({
        firstName: item.fullName,
        phone: item.phone,
        role: item.role,
        programType: item.programType,
        isOnboarded: true,
        status: 'ACTIVE',
      });

      userId = user._id.toString();
    }

    // If parent, create child record
    if (item.role === 'PARENT' && item.childName) {
      const child = await this.childModel.create({
        firstName: item.childName,
        age: item.age,
        groupId: dto.groupId,
        belt: 'WHITE',
        monthlyGoalTarget: 12,
      });

      // Create parent-child link
      await this.parentChildModel.create({
        parentId: userId,
        childId: child._id.toString(),
        relationship: 'parent',
      });
    }

    item.status = 'CONVERTED';
    item.convertedAt = new Date();
    item.userId = userId;

    await item.save();

    return {
      consultation: item,
      userId,
      message: 'Lead successfully converted to enrolled user',
    };
  }

  async getStats() {
    const total = await this.consultationModel.countDocuments();
    const newCount = await this.consultationModel.countDocuments({ status: 'NEW' });
    const contactedCount = await this.consultationModel.countDocuments({ status: 'CONTACTED' });
    const bookedCount = await this.consultationModel.countDocuments({ status: 'BOOKED_TRIAL' });
    const trialDoneCount = await this.consultationModel.countDocuments({ status: 'TRIAL_DONE' });
    const convertedCount = await this.consultationModel.countDocuments({ status: 'CONVERTED' });
    const lostCount = await this.consultationModel.countDocuments({ status: 'LOST' });

    const conversionRate = total > 0 ? Math.round((convertedCount / total) * 100) : 0;

    // By program type
    const byProgram = await this.consultationModel.aggregate([
      { $group: { _id: '$programType', count: { $sum: 1 } } },
    ]);

    return {
      total,
      newCount,
      contactedCount,
      bookedCount,
      trialDoneCount,
      convertedCount,
      lostCount,
      conversionRate,
      byProgram,
    };
  }
}
