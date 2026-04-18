import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument, TenantPlan } from '../../schemas/tenant.schema';

export interface CreateTenantDto {
  slug: string;
  name: string;
  brandName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  plan?: TenantPlan;
}

export interface UpdateTenantDto {
  name?: string;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  plan?: TenantPlan;
  isActive?: boolean;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
}

// Plan configurations
const PLAN_CONFIG: Record<TenantPlan, { studentsLimit: number; clubsLimit: number; coachesLimit: number; features: string[]; priceMonthly: number }> = {
  START: {
    studentsLimit: 50,
    clubsLimit: 1,
    coachesLimit: 3,
    features: ['basic_dashboard', 'attendance', 'payments', 'messages'],
    priceMonthly: 990,
  },
  PRO: {
    studentsLimit: 200,
    clubsLimit: 3,
    coachesLimit: 10,
    features: ['basic_dashboard', 'attendance', 'payments', 'messages', 'competitions', 'booking', 'discounts', 'referrals', 'retention'],
    priceMonthly: 2490,
  },
  AI: {
    studentsLimit: 1000,
    clubsLimit: 10,
    coachesLimit: 50,
    features: ['basic_dashboard', 'attendance', 'payments', 'messages', 'competitions', 'booking', 'discounts', 'referrals', 'retention', 'metabrain', 'ltv', 'predictive', 'growth', 'white_label'],
    priceMonthly: 4990,
  },
};

@Injectable()
export class TenantsService {
  private readonly logger = new Logger('TenantsService');

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
  ) {}

  /**
   * Create new tenant
   */
  async create(dto: CreateTenantDto): Promise<Tenant> {
    // Check if slug exists
    const existing = await this.tenantModel.findOne({ slug: dto.slug });
    if (existing) {
      throw new ConflictException(`Tenant with slug "${dto.slug}" already exists`);
    }

    const plan = dto.plan || 'START';
    const config = PLAN_CONFIG[plan];

    const tenant = new this.tenantModel({
      ...dto,
      plan,
      ...config,
    });

    await tenant.save();
    this.logger.log(`Created tenant: ${dto.name} (${dto.slug})`);
    return tenant;
  }

  /**
   * Get tenant by slug
   */
  async getBySlug(slug: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findOne({ slug });
    if (!tenant) {
      throw new NotFoundException(`Tenant "${slug}" not found`);
    }
    return tenant;
  }

  /**
   * Get tenant by ID
   */
  async getById(id: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }
    return tenant;
  }

  /**
   * List all tenants (for Super Admin)
   */
  async findAll(options?: { isActive?: boolean; plan?: TenantPlan }): Promise<Tenant[]> {
    const filter: any = {};
    if (options?.isActive !== undefined) filter.isActive = options.isActive;
    if (options?.plan) filter.plan = options.plan;

    return this.tenantModel.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Update tenant
   */
  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.tenantModel.findById(id);
    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    // If plan changed, update limits
    if (dto.plan && dto.plan !== tenant.plan) {
      const config = PLAN_CONFIG[dto.plan];
      Object.assign(dto, config);
    }

    Object.assign(tenant, dto);
    await tenant.save();

    this.logger.log(`Updated tenant: ${tenant.name} (${tenant.slug})`);
    return tenant;
  }

  /**
   * Upgrade tenant plan
   */
  async upgradePlan(id: string, newPlan: TenantPlan): Promise<Tenant> {
    return this.update(id, { plan: newPlan });
  }

  /**
   * Deactivate tenant
   */
  async deactivate(id: string): Promise<Tenant> {
    return this.update(id, { isActive: false });
  }

  /**
   * Activate tenant
   */
  async activate(id: string): Promise<Tenant> {
    return this.update(id, { isActive: true });
  }

  /**
   * Update tenant stats (called by CRON)
   */
  async updateStats(id: string, stats: { totalStudents?: number; totalCoaches?: number; totalRevenue?: number; monthlyRevenue?: number }): Promise<void> {
    await this.tenantModel.updateOne({ _id: id }, { $set: stats });
  }

  /**
   * Check if tenant has feature
   */
  async hasFeature(tenantId: string, feature: string): Promise<boolean> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) return false;
    return tenant.features.includes(feature);
  }

  /**
   * Check if tenant is within limits
   */
  async checkLimits(tenantId: string, resource: 'students' | 'clubs' | 'coaches', count: number): Promise<boolean> {
    const tenant = await this.tenantModel.findById(tenantId);
    if (!tenant) return false;

    switch (resource) {
      case 'students': return count < tenant.studentsLimit;
      case 'clubs': return count < tenant.clubsLimit;
      case 'coaches': return count < tenant.coachesLimit;
      default: return true;
    }
  }

  /**
   * Get SaaS overview for Super Admin
   */
  async getSaasOverview(): Promise<{
    totalTenants: number;
    activeTenants: number;
    byPlan: Record<TenantPlan, number>;
    totalMRR: number;
    totalStudents: number;
  }> {
    const tenants = await this.tenantModel.find();

    const byPlan: Record<TenantPlan, number> = { START: 0, PRO: 0, AI: 0 };
    let totalMRR = 0;
    let totalStudents = 0;
    let activeTenants = 0;

    for (const t of tenants) {
      byPlan[t.plan]++;
      if (t.isActive) {
        activeTenants++;
        totalMRR += t.priceMonthly;
      }
      totalStudents += t.totalStudents;
    }

    return {
      totalTenants: tenants.length,
      activeTenants,
      byPlan,
      totalMRR,
      totalStudents,
    };
  }

  /**
   * Seed default tenant (for development)
   */
  async seedDefault(): Promise<Tenant> {
    const existing = await this.tenantModel.findOne({ slug: 'ataka-kyiv' });
    if (existing) return existing;

    return this.create({
      slug: 'ataka-kyiv',
      name: 'АТАКА Київ',
      brandName: 'АТАКА',
      ownerEmail: 'admin@ataka.com.ua',
      ownerPhone: '+380991001001',
      plan: 'AI',
    });
  }
}
