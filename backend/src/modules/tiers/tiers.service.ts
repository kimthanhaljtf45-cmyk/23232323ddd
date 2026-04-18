import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MembershipTier, MembershipTierDocument } from '../../schemas/membership-tier.schema';
import { CreateTierDto, UpdateTierDto } from './tiers.dto';

@Injectable()
export class TiersService {
  constructor(
    @InjectModel(MembershipTier.name) private tierModel: Model<MembershipTierDocument>,
  ) {}

  async create(dto: CreateTierDto): Promise<MembershipTier> {
    const tier = new this.tierModel(dto);
    return tier.save();
  }

  async findAll(clubId?: string): Promise<MembershipTier[]> {
    const query: any = { isActive: true };
    if (clubId) query.clubId = clubId;
    return this.tierModel.find(query).sort({ price: 1 }).exec();
  }

  async findOne(id: string): Promise<MembershipTier> {
    const tier = await this.tierModel.findById(id).exec();
    if (!tier) throw new NotFoundException('Tier not found');
    return tier;
  }

  async findByName(name: string, clubId: string): Promise<MembershipTier | null> {
    return this.tierModel.findOne({ name, clubId, isActive: true }).exec();
  }

  async update(id: string, dto: UpdateTierDto): Promise<MembershipTier> {
    const tier = await this.tierModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!tier) throw new NotFoundException('Tier not found');
    return tier;
  }

  async remove(id: string): Promise<void> {
    await this.tierModel.findByIdAndUpdate(id, { isActive: false }).exec();
  }

  // Отримати знижку на персоналку для тарифу
  async getPersonalDiscount(tierId: string): Promise<number> {
    const tier = await this.findOne(tierId);
    return tier.personalDiscount || 0;
  }

  // Перевірити чи доступні персоналки
  async canBookPersonal(tierId: string): Promise<boolean> {
    const tier = await this.findOne(tierId);
    return tier.includesPersonal || false;
  }

  // Створити дефолтні тарифи для клубу
  async createDefaultTiers(clubId: string): Promise<MembershipTier[]> {
    const defaults = [
      {
        clubId,
        name: 'BASE',
        price: 2000,
        trainingsPerWeek: 2,
        includesPersonal: false,
        includesCompetitions: false,
        prioritySupport: false,
        personalDiscount: 0,
        description: 'Базовий абонемент',
        benefits: ['2 тренування на тиждень', 'Групові заняття'],
      },
      {
        clubId,
        name: 'PRO',
        price: 3500,
        trainingsPerWeek: 4,
        includesPersonal: false,
        includesCompetitions: true,
        prioritySupport: false,
        personalDiscount: 20,
        description: 'Розширений абонемент',
        benefits: ['4 тренування на тиждень', 'Доступ до змагань', '-20% на персоналки'],
      },
      {
        clubId,
        name: 'VIP',
        price: 6000,
        trainingsPerWeek: 7,
        includesPersonal: true,
        freePersonalSessions: 2,
        includesCompetitions: true,
        prioritySupport: true,
        personalDiscount: 50,
        description: 'VIP абонемент',
        benefits: [
          'Безлімітні групові заняття',
          '2 персоналки в місяць',
          '-50% на додаткові персоналки',
          'Пріоритетна підтримка',
        ],
      },
    ];

    const tiers = [];
    for (const tierData of defaults) {
      const existing = await this.findByName(tierData.name, clubId);
      if (!existing) {
        const tier = await this.create(tierData);
        tiers.push(tier);
      } else {
        tiers.push(existing);
      }
    }
    return tiers;
  }
}
