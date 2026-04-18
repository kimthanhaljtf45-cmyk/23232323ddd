import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Child.name)
    private readonly childModel: Model<ChildDocument>,
    @InjectModel(ParentChild.name)
    private readonly parentChildModel: Model<ParentChildDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async getPaymentsForParent(parentId: string) {
    const links = await this.parentChildModel.find({ parentId });
    const childIds = links.map((l) => l.childId);

    const payments = await this.paymentModel.find({ childId: { $in: childIds } });

    const result = [];
    for (const payment of payments) {
      const paymentData = this.serialize(payment);
      const child = await this.childModel.findById(payment.childId);
      paymentData.child = this.serialize(child);
      result.push(paymentData);
    }

    return result;
  }

  async getPaymentById(paymentId: string) {
    const payment = await this.paymentModel.findById(paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const paymentData = this.serialize(payment);
    const child = await this.childModel.findById(payment.childId);
    paymentData.child = this.serialize(child);

    return paymentData;
  }

  async confirmPayment(paymentId: string, proofUrl?: string) {
    const payment = await this.paymentModel.findByIdAndUpdate(
      paymentId,
      {
        $set: {
          status: 'UNDER_REVIEW',
          proofUrl,
        },
      },
      { new: true },
    );

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return {
      message: 'Оплату підтверджено',
      payment: this.serialize(payment),
    };
  }

  async approvePayment(paymentId: string, adminId: string) {
    const payment = await this.paymentModel.findByIdAndUpdate(
      paymentId,
      {
        $set: {
          status: 'PAID',
          paidAt: new Date().toISOString(),
          approvedById: adminId,
        },
      },
      { new: true },
    );

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // Notify parent
    const parentLink = await this.parentChildModel.findOne({ childId: payment.childId });
    if (parentLink) {
      const child = await this.childModel.findById(payment.childId);
      const childName = child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'дитину';

      await this.notificationsService.notifyUser(
        parentLink.parentId,
        'PAYMENT_APPROVED',
        'Оплату підтверджено',
        `Оплату ${payment.amount} грн за ${childName} підтверджено`,
        { paymentId, action: 'open_payment', screen: '/payments', params: { id: paymentId } },
      );
    }

    return {
      message: 'Оплату затверджено',
      payment: this.serialize(payment),
    };
  }
}
