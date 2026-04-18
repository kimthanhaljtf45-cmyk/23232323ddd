import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// ================== TYPES ==================

export type Segment = 'VIP' | 'ACTIVE' | 'WARNING' | 'CHURN_RISK';

export interface MetaOffer {
  title: string;
  description: string;
  discountLabel?: string;
  childId?: string;
  offerId?: string;
  expiresAt?: string;
}

export interface ParentMetaChild {
  childId: string;
  childName: string;
  riskScore: number;
  segment: Segment;
  attendanceRate: number;
  missedInRow: number;
}

export interface ParentMetaData {
  children: ParentMetaChild[];
  offers: MetaOffer[];
  recommendations: Array<{
    type: string;
    text: string;
    childId: string;
  }>;
}

export interface CoachMetaAction {
  id: string;
  childId?: string;
  childName: string;
  action: string;
  actionType?: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | 'critical' | 'high' | 'medium' | 'low';
  parentId?: string;
  parentPhone?: string;
  parentName?: string;
}

export interface CoachMetaRiskItem {
  childId: string;
  name: string;
  segment: Segment;
  riskScore: number;
  status: 'good' | 'warning' | 'critical';
  signals: string[];
  parentPhone?: string;
  parentName?: string;
}

export interface CoachMetaData {
  totalStudents: number;
  criticalCount: number;
  warningCount: number;
  goodCount: number;
  topRisks: CoachMetaRiskItem[];
  recommendedActions: CoachMetaAction[];
  recommendations: string[];
  items?: CoachMetaRiskItem[]; // alias for topRisks
  actions?: CoachMetaAction[]; // alias for recommendedActions
}

export interface AdminMetaSummary {
  totalStudents: number;
  totalParents: number;
  totalCoaches: number;
  criticalRisks: number;
  warningRisks: number;
  healthyStudents: number;
}

export interface AdminMetaRevenue {
  total: number;
  pending: number;
  overdue: number;
  atRisk: number;
  savedByDiscounts?: number;
}

export interface AdminMetaPredictions {
  churnProbability: number;
  churnCount: number;
  expectedRevenueLoss: number;
}

export interface AdminMetaRisk {
  childId: string;
  name: string;
  risk: number;
  status: 'good' | 'warning' | 'critical';
  signals: string[];
}

export interface AdminMetaData {
  summary: AdminMetaSummary;
  revenue: AdminMetaRevenue;
  predictions: AdminMetaPredictions;
  topRisks: AdminMetaRisk[];
  weights?: Record<string, number>;
}

// ================== HOOKS ==================

/**
 * Hook for Parent MetaBrain data
 * Returns: children insights, personalized offers, recommendations
 */
export function useParentMeta() {
  return useQuery<ParentMetaData>({
    queryKey: ['meta-parent'],
    queryFn: async () => {
      const response = await api.getMetaParent();
      return response;
    },
    staleTime: 60000, // 1 minute
    retry: 1,
  });
}

/**
 * Hook for Coach MetaBrain data
 * Returns: risk list, action queue, student insights
 */
export function useCoachMeta() {
  return useQuery<CoachMetaData>({
    queryKey: ['meta-coach'],
    queryFn: async () => {
      const response = await api.getMetaCoach();
      // Normalize response to have both items/topRisks and actions/recommendedActions
      return {
        ...response,
        items: response.items || response.topRisks || [],
        actions: response.actions || response.recommendedActions || [],
        topRisks: response.topRisks || response.items || [],
        recommendedActions: response.recommendedActions || response.actions || [],
      };
    },
    staleTime: 30000, // 30 seconds
    retry: 1,
  });
}

/**
 * Hook for Admin MetaBrain data
 * Returns: overview stats, revenue at risk, predictions
 */
export function useAdminMeta() {
  return useQuery<AdminMetaData>({
    queryKey: ['meta-admin'],
    queryFn: async () => {
      const response = await api.getMetaAdmin();
      return response;
    },
    staleTime: 60000, // 1 minute
    retry: 1,
  });
}

// ================== SECTION BUILDERS ==================

type DashboardSection = {
  key: string;
  type: string;
  data?: any;
  visible: boolean;
};

/**
 * Build Parent Dashboard sections based on meta and dashboard data
 */
export function buildParentDashboardSections(
  meta: ParentMetaData | undefined,
  dashboard: any,
  alerts: any[],
  retention: any
): DashboardSection[] {
  const sections: DashboardSection[] = [];

  // 1. Hero - always visible
  sections.push({ key: 'hero', type: 'HERO', visible: true });

  // 2. Critical Alerts
  const criticalAlerts = alerts?.filter(a => a.severity === 'critical') || [];
  sections.push({
    key: 'critical-alerts',
    type: 'CRITICAL_ALERTS',
    data: criticalAlerts,
    visible: criticalAlerts.length > 0,
  });

  // 3. Parent Retention Card (if segment is WARNING or CHURN_RISK)
  const hasAtRiskChild = meta?.children?.some(
    c => c.segment === 'WARNING' || c.segment === 'CHURN_RISK'
  );
  if (hasAtRiskChild) {
    const riskChild = meta?.children?.find(
      c => c.segment === 'WARNING' || c.segment === 'CHURN_RISK'
    );
    sections.push({
      key: 'retention-card',
      type: 'PARENT_RETENTION_CARD',
      data: riskChild,
      visible: true,
    });
  }

  // 4. Parent Offer Card (if offer exists and not expired)
  const validOffers = meta?.offers?.filter(o => {
    if (!o.expiresAt) return true;
    return new Date(o.expiresAt) > new Date();
  }) || [];
  if (validOffers.length > 0) {
    sections.push({
      key: 'offer-card',
      type: 'PARENT_OFFER_CARD',
      data: validOffers[0],
      visible: true,
    });
  }

  // 5. Children Overview
  sections.push({
    key: 'children-overview',
    type: 'CHILDREN_OVERVIEW',
    data: dashboard?.children || meta?.children,
    visible: true,
  });

  // 6. Next Training
  sections.push({
    key: 'next-training',
    type: 'NEXT_TRAINING',
    data: dashboard?.nextTrainings,
    visible: (dashboard?.nextTrainings?.length || 0) > 0,
  });

  // 7. Payment Status
  sections.push({
    key: 'payment-status',
    type: 'PAYMENT_STATUS',
    data: dashboard?.payments,
    visible: true,
  });

  // 8. Messages Preview
  sections.push({
    key: 'messages-preview',
    type: 'MESSAGES_PREVIEW',
    data: dashboard?.messages,
    visible: (dashboard?.messages?.length || 0) > 0,
  });

  // 9. Quick Actions
  sections.push({ key: 'quick-actions', type: 'QUICK_ACTIONS', visible: true });

  // 10. Feed Preview
  sections.push({
    key: 'feed-preview',
    type: 'FEED_PREVIEW',
    data: dashboard?.feed,
    visible: (dashboard?.feed?.length || 0) > 0,
  });

  return sections;
}

/**
 * Build Coach Dashboard sections based on meta and dashboard data
 */
export function buildCoachDashboardSections(
  meta: CoachMetaData | undefined,
  dashboard: any
): DashboardSection[] {
  const sections: DashboardSection[] = [];

  // 1. Coach Hero
  sections.push({
    key: 'coach-hero',
    type: 'COACH_HERO',
    data: dashboard,
    visible: true,
  });

  // 2. Coach Action Queue (FIRST - actionable layer)
  const actions = meta?.actions || meta?.recommendedActions || [];
  sections.push({
    key: 'action-queue',
    type: 'COACH_ACTION_QUEUE',
    data: actions,
    visible: actions.length > 0,
  });

  // 3. Coach Risk List
  const risks = meta?.items || meta?.topRisks || [];
  sections.push({
    key: 'risk-list',
    type: 'COACH_RISK_LIST',
    data: risks,
    visible: risks.length > 0,
  });

  // 4. Today Schedule Block
  sections.push({
    key: 'today-schedule',
    type: 'TODAY_SCHEDULE',
    data: dashboard?.schedules,
    visible: (dashboard?.schedules?.length || 0) > 0,
  });

  // 5. At Risk Students Block
  sections.push({
    key: 'at-risk-students',
    type: 'AT_RISK_STUDENTS',
    data: meta?.topRisks?.filter(r => r.status === 'critical' || r.status === 'warning'),
    visible: (meta?.criticalCount || 0) + (meta?.warningCount || 0) > 0,
  });

  // 6. Competitions Today Block
  sections.push({
    key: 'competitions-today',
    type: 'COMPETITIONS_TODAY',
    data: dashboard?.competitionsToday,
    visible: (dashboard?.competitionsToday?.length || 0) > 0,
  });

  return sections;
}

/**
 * Build Admin Dashboard sections based on meta and dashboard data
 */
export function buildAdminDashboardSections(
  meta: AdminMetaData | undefined,
  dashboard: any
): DashboardSection[] {
  const sections: DashboardSection[] = [];

  // 1. Admin Hero
  sections.push({
    key: 'admin-hero',
    type: 'ADMIN_HERO',
    data: {
      totalStudents: meta?.summary?.totalStudents,
      totalRevenue: meta?.revenue?.total,
    },
    visible: true,
  });

  // 2. Admin Risk Overview (TOP PRIORITY)
  sections.push({
    key: 'risk-overview',
    type: 'ADMIN_RISK_OVERVIEW',
    data: {
      totalStudents: meta?.summary?.totalStudents || 0,
      riskCount: meta?.summary?.criticalRisks || 0,
      warningCount: meta?.summary?.warningRisks || 0,
      vipCount: meta?.summary?.healthyStudents || 0,
    },
    visible: true,
  });

  // 3. Admin Revenue Risk Card
  sections.push({
    key: 'revenue-risk',
    type: 'ADMIN_REVENUE_RISK',
    data: {
      revenueAtRisk: meta?.revenue?.atRisk || 0,
      activeRevenue: meta?.revenue?.total || 0,
      savedUsers: meta?.revenue?.savedByDiscounts || 0,
    },
    visible: (meta?.revenue?.atRisk || 0) > 0,
  });

  // 4. Business Metrics Block
  sections.push({
    key: 'business-metrics',
    type: 'BUSINESS_METRICS',
    data: meta?.summary,
    visible: true,
  });

  // 5. Revenue Block
  sections.push({
    key: 'revenue-block',
    type: 'REVENUE_BLOCK',
    data: meta?.revenue,
    visible: true,
  });

  // 6. Retention Block
  sections.push({
    key: 'retention-block',
    type: 'RETENTION_BLOCK',
    data: dashboard?.retention,
    visible: true,
  });

  // 7. Group Performance Block
  sections.push({
    key: 'group-performance',
    type: 'GROUP_PERFORMANCE',
    data: dashboard?.groups,
    visible: (dashboard?.groups?.length || 0) > 0,
  });

  // 8. Lead Pipeline Preview
  sections.push({
    key: 'lead-pipeline',
    type: 'LEAD_PIPELINE',
    data: dashboard?.leads,
    visible: dashboard?.leads != null,
  });

  // 9. Competitions KPI
  sections.push({
    key: 'competitions-kpi',
    type: 'COMPETITIONS_KPI',
    data: dashboard?.competitions,
    visible: dashboard?.competitions != null,
  });

  return sections;
}
