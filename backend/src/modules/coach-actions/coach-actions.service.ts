import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CoachAction, CoachActionDocument, CoachActionType, CoachActionSeverity, CoachActionStatus } from '../../schemas/coach-action.schema';

export interface CreateCoachActionDto {
  coachId: string;
  type: CoachActionType;
  severity: CoachActionSeverity;
  title: string;
  message?: string;
  childId?: string;
  groupId?: string;
  parentId?: string;
  alertId?: string;
  screen?: string;
  params?: Record<string, any>;
  meta?: Record<string, any>;
}

@Injectable()
export class CoachActionsService {
  private readonly logger = new Logger(CoachActionsService.name);

  constructor(
    @InjectModel(CoachAction.name) private actionModel: Model<CoachActionDocument>,
  ) {}

  async create(dto: CreateCoachActionDto): Promise<CoachAction> {
    // Check if similar open action exists
    const existing = await this.actionModel.findOne({
      coachId: dto.coachId,
      type: dto.type,
      childId: dto.childId,
      status: 'OPEN',
    });

    if (existing) {
      this.logger.debug(`Action ${dto.type} already exists for coach ${dto.coachId}`);
      return existing;
    }

    const action = new this.actionModel(dto);
    await action.save();
    this.logger.log(`Created action ${dto.type} for coach ${dto.coachId}`);
    return action;
  }

  async findByCoach(coachId: string, status?: CoachActionStatus): Promise<CoachAction[]> {
    const query: any = { coachId };
    if (status) {
      query.status = status;
    } else {
      query.status = { $in: ['OPEN', 'SNOOZED'] };
      query.$or = [
        { snoozedUntil: { $exists: false } },
        { snoozedUntil: { $lte: new Date() } },
      ];
    }
    return this.actionModel.find(query).sort({ severity: 1, createdAt: -1 }).exec();
  }

  async getActionsWithSummary(coachId: string) {
    const actions = await this.findByCoach(coachId);
    
    const summary = {
      total: actions.length,
      critical: actions.filter(a => a.severity === 'critical').length,
      warning: actions.filter(a => a.severity === 'warning').length,
      info: actions.filter(a => a.severity === 'info').length,
    };

    return {
      summary,
      items: actions.map(a => ({
        id: (a as any)._id.toString(),
        type: a.type,
        severity: a.severity,
        title: a.title,
        message: a.message,
        childId: a.childId,
        groupId: a.groupId,
        screen: a.screen,
        params: a.params,
        status: a.status,
        createdAt: (a as any).createdAt,
      })),
    };
  }

  async complete(actionId: string, completedBy?: string): Promise<CoachAction | null> {
    return this.actionModel.findByIdAndUpdate(
      actionId,
      {
        status: 'DONE',
        completedAt: new Date(),
        completedBy,
      },
      { new: true },
    ).exec();
  }

  async snooze(actionId: string, until: Date): Promise<CoachAction | null> {
    return this.actionModel.findByIdAndUpdate(
      actionId,
      {
        status: 'SNOOZED',
        snoozedUntil: until,
      },
      { new: true },
    ).exec();
  }

  async findById(actionId: string): Promise<CoachAction | null> {
    return this.actionModel.findById(actionId).exec();
  }

  async deleteCompleted(olderThan: Date): Promise<number> {
    const result = await this.actionModel.deleteMany({
      status: 'DONE',
      completedAt: { $lt: olderThan },
    }).exec();
    return result.deletedCount;
  }
}
