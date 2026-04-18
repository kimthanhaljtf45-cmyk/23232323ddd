import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Referral, ReferralDocument } from '../../schemas/referral.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { DiscountsService } from '../discounts/discounts.service';
import { CreateReferralDto, ApplyReferralCodeDto } from './dto';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel(Referral.name) private referralModel: Model<ReferralDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly discountsService: DiscountsService,
  ) {}

  // ==================== REFERRAL CODE GENERATION ====================

  generateReferralCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'ATAKA';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  async getUserReferralCode(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // If user doesn't have a referral code, generate one
    if (!user['referralCode']) {
      const code = this.generateReferralCode();
      await this.userModel.findByIdAndUpdate(userId, { referralCode: code });
      return code;
    }

    return user['referralCode'];
  }

  // ==================== APPLY REFERRAL CODE ====================

  async applyReferralCode(
    invitedUserId: string,
    dto: ApplyReferralCodeDto,
  ): Promise<{ success: boolean; message: string }> {
    const { referralCode } = dto;

    // Find inviter by referral code
    const inviter = await this.userModel.findOne({
      referralCode: referralCode.toUpperCase(),
    });

    if (!inviter) {
      throw new BadRequestException('Реферальний код не знайдено');
    }

    // Check if user is trying to use their own code
    if (inviter._id.toString() === invitedUserId) {
      throw new BadRequestException('Ви не можете використати свій власний код');
    }

    // Check if already has referral
    const existingReferral = await this.referralModel.findOne({
      invitedUserId,
    });

    if (existingReferral) {
      throw new BadRequestException('Ви вже використали реферальний код');
    }

    // Create referral record
    await this.referralModel.create({
      inviterUserId: inviter._id.toString(),
      invitedUserId,
      referralCode,
      status: 'REGISTERED',
      registeredAt: new Date(),
    });

    return {
      success: true,
      message: 'Реферальний код застосовано!',
    };
  }

  // ==================== CONFIRM REFERRAL (ON PAYMENT) ====================

  async confirmReferral(invitedUserId: string): Promise<void> {
    const referral = await this.referralModel.findOne({
      invitedUserId,
      status: 'REGISTERED',
    });

    if (!referral) return;

    // Update status to CONFIRMED
    referral.status = 'CONFIRMED';
    referral.confirmedAt = new Date();
    await referral.save();

    // Process rewards
    await this.processReferralRewards(referral);
  }

  private async processReferralRewards(referral: ReferralDocument): Promise<void> {
    // Count how many successful referrals the inviter has
    const confirmedCount = await this.referralModel.countDocuments({
      inviterUserId: referral.inviterUserId,
      status: { $in: ['CONFIRMED', 'REWARDED'] },
    });

    // Determine reward type
    // 1 friend = -50%
    // 2+ friends = free month
    let inviterRewardType = 'PERCENT_50';
    if (confirmedCount >= 2) {
      inviterRewardType = 'FREE_MONTH';
    }

    // Give reward to invited user (10% on first payment)
    referral.invitedRewardType = 'PERCENT_10';
    referral.invitedRewardGiven = true;
    
    // Give reward to inviter
    referral.inviterRewardType = inviterRewardType;
    referral.inviterRewardGiven = true;
    referral.status = 'REWARDED';
    referral.rewardedAt = new Date();

    await referral.save();
  }

  // ==================== GET USER REFERRALS ====================

  async getUserReferrals(userId: string): Promise<{
    myCode: string;
    invitedCount: number;
    confirmedCount: number;
    rewardsEarned: string[];
    referrals: Referral[];
  }> {
    const myCode = await this.getUserReferralCode(userId);
    
    const referrals = await this.referralModel.find({
      inviterUserId: userId,
    }).sort({ createdAt: -1 });

    const invitedCount = referrals.length;
    const confirmedCount = referrals.filter(
      r => ['CONFIRMED', 'REWARDED'].includes(r.status)
    ).length;

    const rewardsEarned: string[] = [];
    for (const ref of referrals) {
      if (ref.inviterRewardGiven && ref.inviterRewardType) {
        if (ref.inviterRewardType === 'FREE_MONTH') {
          rewardsEarned.push('Безкоштовний місяць');
        } else if (ref.inviterRewardType === 'PERCENT_50') {
          rewardsEarned.push('Знижка 50%');
        }
      }
    }

    return {
      myCode,
      invitedCount,
      confirmedCount,
      rewardsEarned,
      referrals,
    };
  }

  // ==================== CHECK IF USER HAS REFERRAL DISCOUNT ====================

  async hasReferralDiscount(userId: string): Promise<{
    hasDiscount: boolean;
    discountType?: string;
    discountValue?: number;
  }> {
    // Check if user was invited and has reward
    const referral = await this.referralModel.findOne({
      invitedUserId: userId,
      invitedRewardGiven: true,
      status: { $in: ['CONFIRMED', 'REWARDED'] },
    });

    if (referral && !referral['invitedRewardUsed']) {
      return {
        hasDiscount: true,
        discountType: 'PERCENT',
        discountValue: 10,
      };
    }

    // Check if user is inviter with pending rewards
    const inviterReferral = await this.referralModel.findOne({
      inviterUserId: userId,
      inviterRewardGiven: true,
      inviterRewardType: { $exists: true },
    }).sort({ rewardedAt: -1 });

    if (inviterReferral && !inviterReferral['inviterRewardUsed']) {
      if (inviterReferral.inviterRewardType === 'FREE_MONTH') {
        return {
          hasDiscount: true,
          discountType: 'FREE_PERIOD',
          discountValue: 1,
        };
      } else if (inviterReferral.inviterRewardType === 'PERCENT_50') {
        return {
          hasDiscount: true,
          discountType: 'PERCENT',
          discountValue: 50,
        };
      }
    }

    return { hasDiscount: false };
  }

  // ==================== ADMIN METHODS ====================

  async getAllReferrals(status?: string): Promise<Referral[]> {
    const filter = status ? { status } : {};
    return this.referralModel.find(filter).sort({ createdAt: -1 });
  }

  async getReferralStats(): Promise<{
    totalReferrals: number;
    pendingCount: number;
    confirmedCount: number;
    rewardedCount: number;
    topInviters: Array<{ userId: string; count: number }>;
  }> {
    const totalReferrals = await this.referralModel.countDocuments();
    const pendingCount = await this.referralModel.countDocuments({ status: 'PENDING' });
    const confirmedCount = await this.referralModel.countDocuments({ status: 'CONFIRMED' });
    const rewardedCount = await this.referralModel.countDocuments({ status: 'REWARDED' });

    const topInvitersAgg = await this.referralModel.aggregate([
      { $match: { status: { $in: ['CONFIRMED', 'REWARDED'] } } },
      { $group: { _id: '$inviterUserId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const topInviters = topInvitersAgg.map(t => ({
      userId: t._id,
      count: t.count,
    }));

    return {
      totalReferrals,
      pendingCount,
      confirmedCount,
      rewardedCount,
      topInviters,
    };
  }
}
