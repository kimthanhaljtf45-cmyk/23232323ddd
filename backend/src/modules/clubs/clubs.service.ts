import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Club, ClubDocument, ClubPlan } from '../../schemas/club.schema';
import { ClubMembership, ClubMembershipDocument } from '../../schemas/club-membership.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';

const PLAN_CONFIG: Record<ClubPlan, { maxBranches: number; maxCoaches: number; maxStudents: number; maxAdmins: number; features: string[]; priceMonthly: number }> = {
  START: { maxBranches: 1, maxCoaches: 3, maxStudents: 50, maxAdmins: 1, features: ['dashboard', 'attendance', 'payments', 'messages'], priceMonthly: 990 },
  PRO: { maxBranches: 5, maxCoaches: 10, maxStudents: 200, maxAdmins: 3, features: ['dashboard', 'attendance', 'payments', 'messages', 'competitions', 'booking', 'discounts', 'referrals', 'retention', 'marketplace'], priceMonthly: 2490 },
  ENTERPRISE: { maxBranches: 999, maxCoaches: 999, maxStudents: 9999, maxAdmins: 10, features: ['dashboard', 'attendance', 'payments', 'messages', 'competitions', 'booking', 'discounts', 'referrals', 'retention', 'marketplace', 'metabrain', 'ltv', 'predictive', 'growth', 'white_label'], priceMonthly: 4990 },
};

@Injectable()
export class ClubsService {
  private readonly logger = new Logger('ClubsService');

  constructor(
    @InjectModel(Club.name) private clubModel: Model<ClubDocument>,
    @InjectModel(ClubMembership.name) private membershipModel: Model<ClubMembershipDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
  ) {}

  // === CRUD ===

  async create(data: { name: string; ownerUserId?: string; plan?: ClubPlan; city?: string; address?: string; phone?: string; email?: string }) {
    const plan = data.plan || 'START';
    const config = PLAN_CONFIG[plan];
    const slug = data.name.toLowerCase().replace(/[^a-zа-яіїєґ0-9]/g, '-').replace(/-+/g, '-');

    const club = await this.clubModel.create({
      ...data,
      slug,
      plan,
      priceMonthly: config.priceMonthly,
      maxBranches: config.maxBranches,
      maxCoaches: config.maxCoaches,
      maxStudents: config.maxStudents,
      maxAdmins: config.maxAdmins,
      features: config.features,
    });

    // Create OWNER membership if ownerUserId provided
    if (data.ownerUserId) {
      await this.membershipModel.create({
        clubId: club._id.toString(),
        userId: data.ownerUserId,
        role: 'OWNER',
        status: 'ACTIVE',
      });
    }

    this.logger.log(`Club created: ${club.name} (${plan})`);
    return this.serialize(club);
  }

  async findAll(filter?: { status?: string; plan?: string }) {
    const query: any = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.plan) query.plan = filter.plan;
    const clubs = await this.clubModel.find(query).sort({ createdAt: -1 }).lean();
    return clubs.map(c => this.serializeLean(c));
  }

  async getById(id: string) {
    const club = await this.clubModel.findById(id).lean();
    if (!club) throw new NotFoundException('Club not found');
    return this.serializeLean(club);
  }

  async update(id: string, data: Partial<Club>) {
    const club = await this.clubModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();
    if (!club) throw new NotFoundException('Club not found');
    return this.serializeLean(club);
  }

  async delete(id: string) {
    await this.clubModel.findByIdAndUpdate(id, { status: 'ARCHIVED', isActive: false });
    return { success: true };
  }

  // === CLUB DASHBOARD ===

  async getDashboard(clubId: string) {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) throw new NotFoundException('Club not found');

    const [students, coaches, groups, paidInvoices, pendingInvoices, overdueInvoices, activeSubs] = await Promise.all([
      this.childModel.countDocuments({ clubId, status: 'ACTIVE' }),
      this.membershipModel.countDocuments({ clubId, role: 'COACH', status: 'ACTIVE' }),
      this.groupModel.countDocuments({ clubId }),
      this.invoiceModel.find({ status: 'PAID' }).lean(),
      this.invoiceModel.find({ status: 'PENDING' }).lean(),
      this.invoiceModel.find({ status: 'OVERDUE' }).lean(),
      this.subscriptionModel.countDocuments({ status: 'ACTIVE' }),
    ]);

    // Revenue aggregation
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyPaid = paidInvoices.filter(inv => inv.paidAt && new Date(inv.paidAt) >= monthStart);
    const totalRevenue = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const monthlyRevenue = monthlyPaid.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalDebt = [...pendingInvoices, ...overdueInvoices].reduce((sum, inv) => sum + (inv.amount || 0), 0);

    // Churn risk (students with low attendance)
    const churnRisk = Math.round(students * 0.08); // ~8% estimate

    // Update cached stats
    await this.clubModel.updateOne({ _id: clubId }, {
      $set: { studentCount: students, coachCount: coaches, groupCount: groups, totalRevenue, monthlyRevenue, totalDebt }
    });

    return {
      club: this.serializeLean(club),
      stats: {
        students,
        coaches,
        groups,
        activeSubs,
        totalRevenue,
        monthlyRevenue,
        totalDebt,
        churnRisk,
        pendingInvoices: pendingInvoices.length,
        overdueInvoices: overdueInvoices.length,
      },
      limits: {
        maxStudents: club.maxStudents,
        maxCoaches: club.maxCoaches,
        maxBranches: club.maxBranches,
        studentsUsage: Math.round((students / (club.maxStudents || 1)) * 100),
        coachesUsage: Math.round((coaches / (club.maxCoaches || 1)) * 100),
      },
      plan: {
        name: club.plan,
        priceMonthly: club.priceMonthly,
        saasStatus: club.saasStatus,
      },
    };
  }

  // === MEMBERSHIPS ===

  async getMemberships(clubId: string) {
    const memberships = await this.membershipModel.find({ clubId, status: 'ACTIVE' }).lean();
    const userIds = memberships.map(m => m.userId);
    const users = await this.userModel.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    return memberships.map(m => {
      const user = userMap.get(m.userId);
      return {
        id: m._id.toString(),
        userId: m.userId,
        role: m.role,
        status: m.status,
        userName: user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Unknown',
        userPhone: user?.phone,
      };
    });
  }

  async addMembership(clubId: string, userId: string, role: string) {
    const existing = await this.membershipModel.findOne({ clubId, userId });
    if (existing) {
      existing.role = role as any;
      existing.status = 'ACTIVE';
      await existing.save();
      return { id: existing._id.toString(), role, status: 'ACTIVE' };
    }
    const membership = await this.membershipModel.create({ clubId, userId, role, status: 'ACTIVE' });
    return { id: membership._id.toString(), role, status: 'ACTIVE' };
  }

  async removeMembership(clubId: string, userId: string) {
    await this.membershipModel.updateOne({ clubId, userId }, { status: 'DISABLED' });
    return { success: true };
  }

  // === PLAN MANAGEMENT ===

  async changePlan(clubId: string, newPlan: ClubPlan) {
    const config = PLAN_CONFIG[newPlan];
    return this.update(clubId, {
      plan: newPlan,
      priceMonthly: config.priceMonthly,
      maxBranches: config.maxBranches,
      maxCoaches: config.maxCoaches,
      maxStudents: config.maxStudents,
      maxAdmins: config.maxAdmins,
      features: config.features,
    } as any);
  }

  async checkLimit(clubId: string, resource: 'students' | 'coaches' | 'branches'): Promise<{ allowed: boolean; current: number; max: number }> {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) return { allowed: false, current: 0, max: 0 };

    let current = 0;
    let max = 0;
    switch (resource) {
      case 'students': current = club.studentCount || 0; max = club.maxStudents || 50; break;
      case 'coaches': current = club.coachCount || 0; max = club.maxCoaches || 3; break;
      case 'branches': current = club.branchCount || 0; max = club.maxBranches || 1; break;
    }
    return { allowed: current < max, current, max };
  }

  // === PLATFORM OVERVIEW (Super Admin) ===

  async getPlatformOverview() {
    const clubs = await this.clubModel.find().lean();
    const active = clubs.filter(c => c.status === 'ACTIVE');

    const byPlan: Record<string, number> = { START: 0, PRO: 0, ENTERPRISE: 0 };
    let totalMRR = 0;
    let totalStudents = 0;

    for (const c of active) {
      byPlan[c.plan] = (byPlan[c.plan] || 0) + 1;
      totalMRR += c.priceMonthly || 0;
      totalStudents += c.studentCount || 0;
    }

    return {
      totalClubs: clubs.length,
      activeClubs: active.length,
      byPlan,
      totalMRR,
      totalStudents,
    };
  }

  // === SEED ===

  async seedDefaultClub(adminUserId: string) {
    const existing = await this.clubModel.findOne({ slug: 'ataka-kyiv' });
    if (existing) return this.serializeLean(existing.toObject());

    return this.create({
      name: 'АТАКА Київ',
      ownerUserId: adminUserId,
      plan: 'PRO',
      city: 'Київ',
      phone: '+380501234567',
      email: 'admin@ataka.com.ua',
    });
  }

  // === HELPERS ===

  private serialize(doc: any) {
    const obj = doc.toObject ? doc.toObject() : doc;
    return this.serializeLean(obj);
  }

  private serializeLean(obj: any) {
    const { _id, __v, ...rest } = obj;
    return { id: _id?.toString(), ...rest };
  }
}
