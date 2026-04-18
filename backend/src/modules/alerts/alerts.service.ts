import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Alert, AlertDocument, AlertType, AlertSeverity } from '../../schemas/alert.schema';

export interface CreateAlertDto {
  userId: string;
  childId?: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  meta?: Record<string, any>;
  expiresAt?: Date;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectModel(Alert.name) private alertModel: Model<AlertDocument>,
  ) {}

  async create(dto: CreateAlertDto): Promise<Alert> {
    // Check if similar unresolved alert exists
    const existing = await this.alertModel.findOne({
      userId: dto.userId,
      childId: dto.childId,
      type: dto.type,
      isResolved: false,
    });

    if (existing) {
      this.logger.debug(`Alert ${dto.type} already exists for user ${dto.userId}`);
      return existing;
    }

    const alert = new this.alertModel(dto);
    await alert.save();
    this.logger.log(`Created alert ${dto.type} for user ${dto.userId}`);
    return alert;
  }

  async findByUser(userId: string, includeResolved = false): Promise<Alert[]> {
    const query: any = { userId };
    if (!includeResolved) {
      query.isResolved = false;
    }
    return this.alertModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findByChild(childId: string, includeResolved = false): Promise<Alert[]> {
    const query: any = { childId };
    if (!includeResolved) {
      query.isResolved = false;
    }
    return this.alertModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findCritical(): Promise<Alert[]> {
    return this.alertModel.find({
      severity: 'critical',
      isResolved: false,
    }).sort({ createdAt: -1 }).exec();
  }

  async findByType(type: AlertType, isResolved?: boolean): Promise<Alert[]> {
    const query: any = { type };
    if (isResolved !== undefined) {
      query.isResolved = isResolved;
    }
    return this.alertModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async resolve(alertId: string, resolvedBy?: string): Promise<Alert | null> {
    return this.alertModel.findByIdAndUpdate(
      alertId,
      {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedBy,
      },
      { new: true },
    ).exec();
  }

  async resolveByTypeAndChild(type: AlertType, childId: string): Promise<void> {
    await this.alertModel.updateMany(
      { type, childId, isResolved: false },
      { isResolved: true, resolvedAt: new Date() },
    ).exec();
  }

  async getSummary(userId?: string): Promise<{
    total: number;
    critical: number;
    warning: number;
    info: number;
  }> {
    const query: any = { isResolved: false };
    if (userId) {
      query.userId = userId;
    }

    const alerts = await this.alertModel.find(query).exec();

    return {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
    };
  }

  async deleteExpired(): Promise<number> {
    const result = await this.alertModel.deleteMany({
      expiresAt: { $lt: new Date() },
    }).exec();
    return result.deletedCount;
  }
}
