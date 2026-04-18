import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Child, ChildDocument } from '../../schemas/child.schema';
import { User, UserDocument } from '../../schemas/user.schema';
import { Group, GroupDocument } from '../../schemas/group.schema';
import { Attendance, AttendanceDocument } from '../../schemas/attendance.schema';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { SmartAlert, SmartAlertDocument } from '../../schemas/smart-alert.schema';
import { Subscription, SubscriptionDocument } from '../../schemas/subscription.schema';
import { Invoice, InvoiceDocument } from '../../schemas/invoice.schema';
import { Location, LocationDocument } from '../../schemas/location.schema';
import { ParentChild, ParentChildDocument } from '../../schemas/parent-child.schema';

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectModel(Child.name) private childModel: Model<ChildDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(SmartAlert.name) private alertModel: Model<SmartAlertDocument>,
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Invoice.name) private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Location.name) private locationModel: Model<LocationDocument>,
    @InjectModel(ParentChild.name) private parentChildModel: Model<ParentChildDocument>,
  ) {}

  async getDashboard() {
    const [
      revenue,
      subscriptions,
      students,
      alerts,
      kpi,
    ] = await Promise.all([
      this.getRevenueStats(),
      this.getSubscriptionStats(),
      this.getStudentStats(),
      this.getAlerts(),
      this.getKPI(),
    ]);

    return {
      revenue,
      subscriptions,
      students,
      alerts,
      kpi, // backwards compatibility
    };
  }

  // NEW: Full revenue stats
  private async getRevenueStats() {
    const invoices = await this.invoiceModel.find({});
    const subscriptions = await this.subscriptionModel.find({ status: 'ACTIVE' });
    
    // Collected = paid invoices this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const paidThisMonth = invoices.filter(inv => 
      inv.status === 'PAID' && 
      new Date((inv as any).paidAt || (inv as any).createdAt) >= monthStart
    );
    const collected = paidThisMonth.reduce((sum, inv) => sum + ((inv as any).amount || 0), 0);
    
    // Expected = active subscriptions * price (monthly approximation)
    let expected = 0;
    for (const sub of subscriptions) {
      // Use finalPrice/months or default 2000/month
      const price = (sub as any).finalPrice || (sub as any).price || 2000;
      const planType = (sub as any).planType;
      let monthly = price;
      if (planType === 'HALF_YEAR') monthly = price / 6;
      else if (planType === 'YEAR') monthly = price / 12;
      expected += monthly;
    }
    expected = Math.round(expected);
    
    // Debt = pending/overdue invoices
    const pendingInvoices = invoices.filter(inv => 
      (inv as any).status === 'PENDING' || (inv as any).status === 'OVERDUE'
    );
    const debt = pendingInvoices.reduce((sum, inv) => sum + ((inv as any).amount || 0), 0);
    
    return {
      collected,
      expected,
      debt,
      collectionRate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
    };
  }

  // NEW: Subscription stats
  private async getSubscriptionStats() {
    const subscriptions = await this.subscriptionModel.find({});
    
    const active = subscriptions.filter(s => s.status === 'ACTIVE').length;
    const paused = subscriptions.filter(s => s.status === 'PAUSED').length;
    
    // Expiring soon = within 7 days
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSoon = subscriptions.filter(s => 
      s.status === 'ACTIVE' && 
      s.endDate && 
      new Date(s.endDate) <= weekFromNow
    ).length;
    
    return {
      active,
      paused,
      expiringSoon,
      total: subscriptions.length,
    };
  }

  // NEW: Student stats with risk analysis
  private async getStudentStats() {
    const children = await this.childModel.find({});
    const total = children.length;
    
    // Active = has attendance in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentAttendance = await this.attendanceModel.find({
      date: { $gte: thirtyDaysAgo.toISOString().slice(0, 10) }
    });
    
    const activeChildIds = new Set(
      recentAttendance
        .filter(a => a.status === 'PRESENT' || a.status === 'LATE')
        .map(a => a.childId)
    );
    
    const active = activeChildIds.size;
    
    // At risk = low attendance (< 50% in last 30 days)
    const childAttendance: Record<string, { total: number; present: number }> = {};
    
    for (const a of recentAttendance) {
      if (!childAttendance[a.childId]) {
        childAttendance[a.childId] = { total: 0, present: 0 };
      }
      childAttendance[a.childId].total++;
      if (a.status === 'PRESENT' || a.status === 'LATE') {
        childAttendance[a.childId].present++;
      }
    }
    
    let atRisk = 0;
    for (const childId in childAttendance) {
      const stats = childAttendance[childId];
      if (stats.total > 0) {
        const rate = (stats.present / stats.total) * 100;
        if (rate < 50) atRisk++;
      }
    }
    
    return {
      total,
      active,
      atRisk,
      inactive: total - active,
    };
  }

  private async getKPI() {
    const totalStudents = await this.childModel.countDocuments({});
    const parentsCount = await this.userModel.countDocuments({ role: 'PARENT' });
    const coachesCount = await this.userModel.countDocuments({ role: 'COACH' });

    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = await this.attendanceModel.find({ date: today });

    const present = todayAttendance.filter((x) => x.status === 'PRESENT').length;
    const attendanceRate = todayAttendance.length
      ? Math.round((present / todayAttendance.length) * 100)
      : 0;

    // Calculate average discipline
    const allAttendance = await this.attendanceModel.find({});
    const totalRecords = allAttendance.length;
    const presentTotal = allAttendance.filter((x) => x.status === 'PRESENT').length;
    const warnedTotal = allAttendance.filter((x) => x.status === 'WARNED').length;
    const lateTotal = allAttendance.filter((x) => x.status === 'LATE').length;

    const weighted = presentTotal * 1.0 + warnedTotal * 0.6 + lateTotal * 0.5;
    const disciplineAvg = totalRecords > 0 ? Math.round((weighted / totalRecords) * 100) : 0;

    return {
      totalStudents,
      parentsCount,
      coachesCount,
      activeToday: present,
      attendanceRate,
      disciplineAvg,
    };
  }

  private async getAttendanceStats() {
    const today = new Date().toISOString().slice(0, 10);
    const records = await this.attendanceModel.find({ date: today });

    const present = records.filter((x) => x.status === 'PRESENT').length;
    const absent = records.filter((x) => x.status === 'ABSENT').length;
    const warned = records.filter((x) => x.status === 'WARNED').length;
    const late = records.filter((x) => x.status === 'LATE').length;

    // Calculate trend (compare with yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayRecords = await this.attendanceModel.find({ date: yesterdayStr });
    const yesterdayPresent = yesterdayRecords.filter((x) => x.status === 'PRESENT').length;

    let trend = 'stable';
    if (records.length > 0 && yesterdayRecords.length > 0) {
      const todayRate = present / records.length;
      const yesterdayRate = yesterdayPresent / yesterdayRecords.length;
      if (todayRate > yesterdayRate + 0.05) trend = 'up';
      else if (todayRate < yesterdayRate - 0.05) trend = 'down';
    }

    return {
      today: { present, absent, warned, late },
      trend,
    };
  }

  private async getDisciplineStats() {
    const groups = await this.groupModel.find({});
    const groupScores: Array<{ name: string; score: number }> = [];

    for (const group of groups) {
      const children = await this.childModel.find({ groupId: group._id.toString() });
      const childIds = children.map((c) => c._id.toString());

      const attendance = await this.attendanceModel.find({ childId: { $in: childIds } });
      if (attendance.length === 0) {
        groupScores.push({ name: group.name, score: 0 });
        continue;
      }

      const present = attendance.filter((a) => a.status === 'PRESENT').length;
      const warned = attendance.filter((a) => a.status === 'WARNED').length;
      const late = attendance.filter((a) => a.status === 'LATE').length;

      const weighted = present * 1.0 + warned * 0.6 + late * 0.5;
      const score = Math.round((weighted / attendance.length) * 100);
      groupScores.push({ name: group.name, score });
    }

    groupScores.sort((a, b) => b.score - a.score);

    const avgScore = groupScores.length > 0
      ? Math.round(groupScores.reduce((acc, g) => acc + g.score, 0) / groupScores.length)
      : 0;

    return {
      avg: avgScore,
      topGroup: groupScores[0]?.name || null,
      worstGroup: groupScores[groupScores.length - 1]?.name || null,
      groups: groupScores,
    };
  }

  private async getBeltDistribution() {
    const children = await this.childModel.find({});
    const map: Record<string, number> = {};

    for (const c of children) {
      const belt = c.belt || 'WHITE';
      map[belt] = (map[belt] || 0) + 1;
    }

    return map;
  }

  private async getRevenue() {
    const payments = await this.paymentModel.find({});

    const month = payments
      .filter((p) => p.status === 'PAID')
      .reduce((acc, p) => acc + (p.amount || 0), 0);

    const pending = payments
      .filter((p) => p.status !== 'PAID')
      .reduce((acc, p) => acc + (p.amount || 0), 0);

    const overdueCount = payments.filter((p) =>
      p.status === 'PENDING' || p.status === 'UNDER_REVIEW'
    ).length;

    return {
      month,
      pending,
      overdueCount,
    };
  }

  private async getAlerts(): Promise<string[]> {
    const alerts: string[] = [];

    // Check expiring subscriptions
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const subscriptions = await this.subscriptionModel.find({
      status: 'ACTIVE',
      endDate: { $lte: threeDaysFromNow }
    });
    if (subscriptions.length > 0) {
      alerts.push(`${subscriptions.length} підписок закінчуються через 3 дні`);
    }

    // Check pending invoices (debt)
    const pendingInvoices = await this.invoiceModel.countDocuments({
      status: { $in: ['PENDING', 'OVERDUE'] }
    });
    if (pendingInvoices > 0) {
      alerts.push(`${pendingInvoices} неоплачених рахунків`);
    }

    // Check low attendance groups
    const groups = await this.groupModel.find({});
    let lowAttendanceCount = 0;
    for (const group of groups) {
      const children = await this.childModel.find({ groupId: group._id.toString() });
      if (children.length === 0) continue;
      
      const childIds = children.map(c => c._id.toString());
      const attendance = await this.attendanceModel.find({ childId: { $in: childIds } });
      if (attendance.length === 0) continue;

      const present = attendance.filter(a => a.status === 'PRESENT').length;
      const rate = (present / attendance.length) * 100;
      if (rate < 60) lowAttendanceCount++;
    }
    if (lowAttendanceCount > 0) {
      alerts.push(`${lowAttendanceCount} груп з низькою відвідуваністю`);
    }

    // Check at-risk students (no attendance in 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const recentAttendance = await this.attendanceModel.find({
      date: { $gte: fourteenDaysAgo.toISOString().slice(0, 10) }
    });
    const activeChildIds = new Set(recentAttendance.map(a => a.childId));
    const totalChildren = await this.childModel.countDocuments({});
    const inactiveChildren = totalChildren - activeChildIds.size;
    if (inactiveChildren > 0) {
      alerts.push(`${inactiveChildren} учнів не відвідували 2+ тижні`);
    }

    return alerts;
  }

  // Admin groups list with stats
  async getGroups() {
    const groups = await this.groupModel.find({});
    const result = [];

    for (const group of groups) {
      const children = await this.childModel.find({ groupId: group._id.toString() });
      const childIds = children.map((c) => c._id.toString());

      const attendance = await this.attendanceModel.find({ childId: { $in: childIds } });
      const total = attendance.length;
      const present = attendance.filter((a) => a.status === 'PRESENT').length;

      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      // Discipline
      const warned = attendance.filter((a) => a.status === 'WARNED').length;
      const late = attendance.filter((a) => a.status === 'LATE').length;
      const weighted = present * 1.0 + warned * 0.6 + late * 0.5;
      const discipline = total > 0 ? Math.round((weighted / total) * 100) : 0;

      // Coach
      let coach = null;
      if (group.coachId) {
        const coachUser = await this.userModel.findById(group.coachId);
        if (coachUser) {
          coach = {
            id: coachUser._id.toString(),
            name: `${coachUser.firstName} ${coachUser.lastName || ''}`.trim(),
          };
        }
      }

      result.push({
        id: group._id.toString(),
        name: group.name,
        students: children.length,
        attendanceRate,
        discipline,
        coach,
      });
    }

    return result;
  }

  // Admin group detail
  async getGroupDetail(groupId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) return null;

    const children = await this.childModel.find({ groupId });
    const studentsData = [];

    for (const child of children) {
      const attendance = await this.attendanceModel.find({ childId: child._id.toString() });
      const total = attendance.length;
      const present = attendance.filter((a) => a.status === 'PRESENT').length;
      const warned = attendance.filter((a) => a.status === 'WARNED').length;
      const late = attendance.filter((a) => a.status === 'LATE').length;

      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
      const weighted = present * 1.0 + warned * 0.6 + late * 0.5;
      const discipline = total > 0 ? Math.round((weighted / total) * 100) : 0;

      studentsData.push({
        id: child._id.toString(),
        name: `${child.firstName} ${child.lastName || ''}`.trim(),
        belt: child.belt || 'WHITE',
        attendance: attendanceRate,
        discipline,
      });
    }

    // Coach
    let coach = null;
    if (group.coachId) {
      const coachUser = await this.userModel.findById(group.coachId);
      if (coachUser) {
        coach = `${coachUser.firstName} ${coachUser.lastName || ''}`.trim();
      }
    }

    return {
      group: {
        id: group._id.toString(),
        name: group.name,
        coach,
      },
      students: studentsData,
    };
  }

  // Admin payments list
  async getPayments(status?: string) {
    const query: any = {};
    if (status === 'overdue') {
      query.status = { $in: ['PENDING', 'UNDER_REVIEW'] };
    } else if (status) {
      query.status = status;
    }

    const payments = await this.paymentModel.find(query).sort({ createdAt: -1 });
    const result = [];

    for (const p of payments) {
      const child = await this.childModel.findById(p.childId);
      result.push({
        id: p._id.toString(),
        childId: p.childId,
        childName: child ? `${child.firstName} ${child.lastName || ''}`.trim() : 'Невідомо',
        amount: p.amount,
        currency: p.currency || 'UAH',
        status: p.status,
        dueDate: p.dueDate,
        description: p.description,
      });
    }

    return result;
  }

  // Admin students list
  async getStudents(filters?: { groupId?: string; belt?: string; lowAttendance?: boolean }) {
    const query: any = {};
    if (filters?.groupId) query.groupId = filters.groupId;
    if (filters?.belt) query.belt = filters.belt;

    const children = await this.childModel.find(query);
    const result = [];

    for (const child of children) {
      const attendance = await this.attendanceModel.find({ childId: child._id.toString() });
      const total = attendance.length;
      const present = attendance.filter((a) => a.status === 'PRESENT').length;
      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;

      if (filters?.lowAttendance && attendanceRate >= 70) continue;

      const group = child.groupId ? await this.groupModel.findById(child.groupId) : null;

      result.push({
        id: child._id.toString(),
        name: `${child.firstName} ${child.lastName || ''}`.trim(),
        belt: child.belt || 'WHITE',
        attendance: attendanceRate,
        groupName: group?.name || null,
      });
    }

    return result;
  }

  // ==================== GROUP MANAGEMENT ====================

  async createGroup(dto: {
    name: string;
    coachId: string;
    locationId?: string;
    programType: string;
    ageRange?: string;
    capacity?: number;
    monthlyPrice?: number;
    schedule?: { day: string; time: string }[];
    description?: string;
  }) {
    console.log('[createGroup] Starting with dto:', dto);
    
    try {
      // Get first location for clubId (for now single-tenant)
      const location = dto.locationId 
        ? await this.locationModel.findById(dto.locationId)
        : await this.locationModel.findOne();
      
      console.log('[createGroup] Found location:', location?.name);
      const clubId = location?._id?.toString() || 'default';
      console.log('[createGroup] Using clubId:', clubId);

      const groupData = {
        name: dto.name,
        clubId,
        coachId: dto.coachId,
        locationId: dto.locationId,
        programType: dto.programType || 'KIDS',
        ageRange: dto.ageRange,
        capacity: dto.capacity || 15,
        monthlyPrice: dto.monthlyPrice || 2000,
        schedule: dto.schedule || [],
        description: dto.description,
        isActive: true,
      };
      console.log('[createGroup] Creating group with data:', groupData);

      const group = await this.groupModel.create(groupData);
      console.log('[createGroup] Group created:', group._id);

      return {
        id: group._id.toString(),
        name: group.name,
        coachId: group.coachId,
        programType: group.programType,
        capacity: group.capacity,
        monthlyPrice: group.monthlyPrice,
      };
    } catch (error) {
      console.error('[createGroup] Error:', error);
      throw error;
    }
  }

  async updateGroup(id: string, dto: {
    name?: string;
    coachId?: string;
    locationId?: string;
    programType?: string;
    ageRange?: string;
    capacity?: number;
    monthlyPrice?: number;
    schedule?: { day: string; time: string }[];
    description?: string;
    isActive?: boolean;
  }) {
    const group = await this.groupModel.findByIdAndUpdate(
      id,
      { $set: dto },
      { new: true }
    );

    if (!group) {
      throw new Error('Group not found');
    }

    return {
      id: group._id.toString(),
      name: group.name,
      coachId: group.coachId,
      programType: group.programType,
      capacity: group.capacity,
      monthlyPrice: group.monthlyPrice,
      isActive: group.isActive,
    };
  }

  async deleteGroup(id: string) {
    // Check if group has students
    const studentsCount = await this.childModel.countDocuments({ groupId: id });
    if (studentsCount > 0) {
      throw new Error(`Cannot delete group with ${studentsCount} students. Remove students first.`);
    }

    await this.groupModel.findByIdAndDelete(id);
    return { success: true };
  }

  async addStudentToGroup(groupId: string, childId: string) {
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    // Check capacity
    const currentStudents = await this.childModel.countDocuments({ groupId });
    if (currentStudents >= group.capacity) {
      throw new Error('Group is at full capacity');
    }

    const child = await this.childModel.findByIdAndUpdate(
      childId,
      { $set: { groupId } },
      { new: true }
    );

    if (!child) {
      throw new Error('Student not found');
    }

    return {
      success: true,
      child: {
        id: child._id.toString(),
        name: `${child.firstName} ${child.lastName || ''}`.trim(),
        groupId,
      },
    };
  }

  async removeStudentFromGroup(groupId: string, childId: string) {
    const child = await this.childModel.findOneAndUpdate(
      { _id: childId, groupId },
      { $unset: { groupId: 1 } },
      { new: true }
    );

    if (!child) {
      throw new Error('Student not found in this group');
    }

    return { success: true };
  }

  // ==================== COACHES ====================

  async getCoaches() {
    const coaches = await this.userModel.find({ role: 'COACH' });
    
    return coaches.map(coach => ({
      id: coach._id.toString(),
      name: `${coach.firstName || ''} ${coach.lastName || ''}`.trim() || coach.phone,
      phone: coach.phone,
      avatarUrl: coach.avatarUrl,
    }));
  }

  // ==================== LOCATIONS ====================

  async getLocations() {
    const locations = await this.locationModel.find({});
    
    return locations.map(loc => ({
      id: loc._id.toString(),
      name: loc.name,
      address: loc.address,
      city: loc.city,
      district: loc.district,
    }));
  }

  // ==================== AVAILABLE STUDENTS ====================

  async getAvailableStudents() {
    // Students without a group
    const children = await this.childModel.find({ 
      $or: [{ groupId: null }, { groupId: { $exists: false } }] 
    });

    return children.map(child => ({
      id: child._id.toString(),
      name: `${child.firstName} ${child.lastName || ''}`.trim(),
      age: child.age,
      belt: child.belt || 'WHITE',
    }));
  }

  // ==================== BRANCHES ====================

  async createBranch(dto: { name: string; address?: string; city?: string; district?: string }) {
    return this.locationModel.create(dto);
  }

  async getBranches() {
    const locations = await this.locationModel.find().sort({ name: 1 }).lean();
    return locations.map(l => ({
      id: l._id.toString(),
      name: l.name,
      address: l.address,
      city: l.city,
      district: l.district,
      status: 'ACTIVE',
    }));
  }

  async updateBranch(id: string, dto: { name?: string; address?: string; status?: string }) {
    await this.locationModel.updateOne({ _id: id }, { $set: dto });
    return this.locationModel.findById(id).lean();
  }

  async deleteBranch(id: string) {
    // Check if any groups use this branch
    const groups = await this.groupModel.countDocuments({ locationId: id });
    if (groups > 0) {
      return { success: false, message: 'Cannot delete branch with active groups' };
    }
    await this.locationModel.deleteOne({ _id: id });
    return { success: true };
  }

  // ==================== PARENTS (P0.1 FIX: unified via ParentChild) ====================

  async getParents() {
    const parents = await this.userModel.find({ role: 'PARENT' }).lean();
    const parentIds = parents.map(p => p._id.toString());

    // P0.1 FIX: Use ONLY ParentChild collection
    const allLinks = await this.parentChildModel.find({ parentId: { $in: parentIds } }).lean();
    
    const childIdsByParent = new Map<string, string[]>();
    for (const link of allLinks) {
      if (!childIdsByParent.has(link.parentId)) childIdsByParent.set(link.parentId, []);
      childIdsByParent.get(link.parentId)!.push(link.childId);
    }

    // Get all children
    const allChildIds = Array.from(childIdsByParent.values()).flat();
    const children = await this.childModel.find({ _id: { $in: allChildIds } }).lean();
    const childMap = new Map(children.map(c => [c._id.toString(), c]));

    const invoices = await this.invoiceModel.find({
      parentId: { $in: parentIds },
    }).lean();

    return parents.map(p => {
      const pid = p._id.toString();
      const pChildIds = childIdsByParent.get(pid) || [];
      const pChildren = pChildIds.map(cid => childMap.get(cid)).filter(Boolean);
      const pInvoices = invoices.filter(i => i.parentId === pid);
      const debt = pInvoices
        .filter(i => i.status === 'OVERDUE')
        .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);

      return {
        id: pid,
        name: `${p.firstName} ${p.lastName || ''}`.trim(),
        phone: p.phone,
        childrenCount: pChildren.length,
        children: pChildren.map(c => ({
          id: c._id.toString(),
          name: `${c.firstName} ${c.lastName || ''}`.trim(),
        })),
        debt,
        invoicesCount: pInvoices.length,
      };
    });
  }

  // P2 FIX: Admin → Parent detail page
  async getParentDetail(parentId: string) {
    const parent = await this.userModel.findById(parentId).lean();
    if (!parent) return null;

    // Get children via ParentChild model
    const parentChildLinks = await this.parentChildModel.find({ parentId }).lean();
    const childIds = parentChildLinks.map(l => l.childId);
    const children = await this.childModel.find({ _id: { $in: childIds } }).lean();

    // Get groups for children
    const groupIds = [...new Set(children.map(c => c.groupId).filter(Boolean))];
    const groups = await this.groupModel.find({ _id: { $in: groupIds } }).lean();
    const groupMap = new Map(groups.map(g => [g._id.toString(), g]));

    // Get subscriptions
    const subscriptions = await this.subscriptionModel.find({ parentId }).lean();

    // Get invoices
    const invoices = await this.invoiceModel.find({ parentId }).sort({ createdAt: -1 }).lean();

    const totalPaid = invoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);
    const debt = invoices
      .filter(i => i.status === 'OVERDUE' || i.status === 'PENDING')
      .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);

    return {
      parent: {
        id: parent._id.toString(),
        name: `${parent.firstName} ${parent.lastName || ''}`.trim(),
        phone: parent.phone,
        email: parent.email,
        createdAt: (parent as any).createdAt,
      },
      children: children.map(c => {
        const group = c.groupId ? groupMap.get(c.groupId) : null;
        return {
          id: c._id.toString(),
          name: `${c.firstName} ${c.lastName || ''}`.trim(),
          age: c.age,
          belt: c.belt,
          groupName: group?.name,
          programType: c.programType,
        };
      }),
      subscriptions: subscriptions.map(s => ({
        id: s._id.toString(),
        planName: s.planName,
        status: s.status,
        startDate: s.startDate,
        endDate: s.endDate,
        finalPrice: s.finalPrice,
      })),
      invoices: invoices.slice(0, 20).map(i => ({
        id: i._id.toString(),
        amount: (i as any).finalAmount || i.amount,
        status: i.status,
        dueDate: i.dueDate,
        paidAt: i.paidAt,
        description: i.description,
      })),
      totalPaid,
      debt,
    };
  }

  // ==================== COACHES CRUD (P2 FIX) ====================

  async createCoach(dto: { firstName: string; lastName?: string; phone: string }) {
    // Check if phone already exists
    const existing = await this.userModel.findOne({ phone: dto.phone });
    if (existing) {
      throw new Error('User with this phone already exists');
    }

    const coach = await this.userModel.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      role: 'COACH',
      status: 'ACTIVE',
      isOnboarded: true,
    });

    return {
      id: coach._id.toString(),
      name: `${coach.firstName} ${coach.lastName || ''}`.trim(),
      phone: coach.phone,
    };
  }

  async updateCoach(coachId: string, dto: { firstName?: string; lastName?: string; phone?: string; status?: string }) {
    await this.userModel.updateOne({ _id: coachId, role: 'COACH' }, { $set: dto });
    const coach = await this.userModel.findById(coachId).lean();
    return coach ? {
      id: coach._id.toString(),
      name: `${coach.firstName} ${coach.lastName || ''}`.trim(),
      phone: coach.phone,
      status: coach.status,
    } : null;
  }

  async deactivateCoach(coachId: string) {
    await this.userModel.updateOne({ _id: coachId, role: 'COACH' }, { $set: { status: 'INACTIVE' } });
    return { success: true, message: 'Тренера деактивовано' };
  }

  async getCoachStats(coachId: string) {
    const coach = await this.userModel.findById(coachId).lean();
    if (!coach) return null;

    const groups = await this.groupModel.find({ coachId }).lean();
    const groupIds = groups.map(g => g._id.toString());
    const students = await this.childModel.find({ groupId: { $in: groupIds } }).lean();
    const studentIds = students.map(s => s._id.toString());

    // Attendance stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const attendance = await this.attendanceModel.find({
      childId: { $in: studentIds },
      date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
    });
    const present = attendance.filter(a => a.status === 'PRESENT').length;
    const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

    // Revenue
    const invoices = await this.invoiceModel.find({ childId: { $in: studentIds } }).lean();
    const totalRevenue = invoices
      .filter(i => i.status === 'PAID')
      .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);
    const totalDebt = invoices
      .filter(i => i.status === 'OVERDUE')
      .reduce((sum, i) => sum + ((i as any).finalAmount || i.amount || 0), 0);

    return {
      coach: {
        id: coach._id.toString(),
        name: `${coach.firstName} ${coach.lastName || ''}`.trim(),
        phone: coach.phone,
        status: coach.status,
      },
      groupsCount: groups.length,
      studentsCount: students.length,
      attendanceRate,
      totalRevenue,
      totalDebt,
      groups: groups.map(g => ({
        id: g._id.toString(),
        name: g.name,
        studentsCount: students.filter(s => s.groupId === g._id.toString()).length,
        capacity: g.capacity,
      })),
    };
  }

  async getCoachLeaderboard() {
    const coaches = await this.userModel.find({ role: 'COACH', status: 'ACTIVE' }).lean();
    const result = [];

    for (const coach of coaches) {
      const coachId = coach._id.toString();
      const groups = await this.groupModel.find({ coachId }).lean();
      const groupIds = groups.map(g => g._id.toString());
      const students = await this.childModel.find({ groupId: { $in: groupIds } }).lean();
      const studentIds = students.map(s => s._id.toString());

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const attendance = await this.attendanceModel.find({
        childId: { $in: studentIds },
        date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] },
      });
      const present = attendance.filter(a => a.status === 'PRESENT').length;
      const attendanceRate = attendance.length > 0 ? Math.round((present / attendance.length) * 100) : 0;

      // Simple KPI: 40% attendance + 30% retention + 30% group fill
      const fillRates = groups.map(g => {
        const count = students.filter(s => s.groupId === g._id.toString()).length;
        return g.capacity > 0 ? (count / g.capacity) * 100 : 0;
      });
      const avgFillRate = fillRates.length > 0
        ? Math.round(fillRates.reduce((s, v) => s + v, 0) / fillRates.length)
        : 0;

      const score = Math.round(attendanceRate * 0.4 + 100 * 0.3 + avgFillRate * 0.3);

      result.push({
        id: coachId,
        name: `${coach.firstName} ${coach.lastName || ''}`.trim(),
        score,
        groupsCount: groups.length,
        studentsCount: students.length,
        attendanceRate,
        fillRate: avgFillRate,
      });
    }

    result.sort((a, b) => b.score - a.score);
    return result.map((c, i) => ({ ...c, rank: i + 1 }));
  }

  // ==================== FINANCE ====================

  async getFinanceOverview() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [paidAgg, pendingAgg, overdueAgg, activeSubs, pausedSubs, expiringSoon] =
      await Promise.all([
        this.invoiceModel.aggregate([
          { $match: { status: 'PAID', paidAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$finalAmount', '$amount'] } } } },
        ]),
        this.invoiceModel.aggregate([
          { $match: { status: 'PENDING' } },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$finalAmount', '$amount'] } } } },
        ]),
        this.invoiceModel.aggregate([
          { $match: { status: 'OVERDUE' } },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$finalAmount', '$amount'] } } } },
        ]),
        this.subscriptionModel.countDocuments({ status: 'ACTIVE' }),
        this.subscriptionModel.countDocuments({ status: 'PAUSED' }),
        this.subscriptionModel.countDocuments({ status: 'RENEWAL_SOON' }),
      ]);

    const collected = paidAgg[0]?.total ?? 0;
    const expected = pendingAgg[0]?.total ?? 0;
    const debt = overdueAgg[0]?.total ?? 0;

    return {
      revenue: {
        collected,
        expected,
        debt,
        collectionRate: (collected + expected) > 0 ? collected / (collected + expected) : 0,
      },
      subscriptions: {
        active: activeSubs,
        paused: pausedSubs,
        expiringSoon,
        total: activeSubs + pausedSubs + expiringSoon,
      },
    };
  }

  async getFinanceDebts() {
    const overdueInvoices = await this.invoiceModel
      .find({ status: 'OVERDUE' })
      .sort({ dueDate: 1 })
      .lean();

    const totalDebt = overdueInvoices.reduce(
      (sum, i) => sum + ((i as any).finalAmount || i.amount || 0),
      0,
    );

    // Get parent info for each invoice
    const parentIds = [...new Set(overdueInvoices.map(i => i.parentId).filter(Boolean))];
    const parents = await this.userModel.find({ _id: { $in: parentIds } }).lean();
    const parentMap = new Map(parents.map(p => [p._id.toString(), p]));

    return {
      totalDebt,
      overdueCount: overdueInvoices.length,
      invoices: overdueInvoices.map(invoice => {
        const parent = parentMap.get(invoice.parentId);
        return {
          id: invoice._id.toString(),
          amount: (invoice as any).finalAmount || invoice.amount,
          dueDate: invoice.dueDate,
          studentId: (invoice as any).childId || (invoice as any).studentId,
          parentName: parent ? `${parent.firstName} ${parent.lastName || ''}`.trim() : 'Unknown',
          parentPhone: parent?.phone,
          description: invoice.description,
        };
      }),
    };
  }

  async remindInvoice(invoiceId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) return { success: false, message: 'Invoice not found' };
    // In a real system, this would trigger a notification/SMS
    return { success: true, message: 'Reminder sent' };
  }

  async markInvoicePaid(invoiceId: string) {
    const invoice = await this.invoiceModel.findById(invoiceId);
    if (!invoice) return { success: false, message: 'Invoice not found' };

    await this.invoiceModel.updateOne(
      { _id: invoiceId },
      { $set: { status: 'PAID', paidAt: new Date(), adminNote: 'Підтверджено адміном' } },
    );

    // Clear debt on student
    const studentId = (invoice as any).childId || (invoice as any).studentId;
    if (studentId) {
      await this.childModel.updateOne(
        { _id: studentId },
        { $set: { hasDebt: false, debtAmount: 0 } },
      );
    }

    // Activate subscription if linked
    if (invoice.subscriptionId) {
      await this.subscriptionModel.updateOne(
        { _id: invoice.subscriptionId },
        { $set: { status: 'ACTIVE' } },
      );
    }

    return { success: true };
  }

}
