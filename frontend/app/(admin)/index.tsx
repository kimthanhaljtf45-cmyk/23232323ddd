import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';
import { useClub } from '../../src/contexts/ClubContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface DashboardData {
  kpi: {
    totalStudents: number;
    activeStudents: number;
    coaches: number;
    groups: number;
  };
  revenue: {
    collected: number;
    expected: number;
    debt: number;
  };
  invoices: {
    paid: number;
    pending: number;
    overdue: number;
    onReview: number;
  };
  subscriptions: {
    active: number;
    paused: number;
    renewalSoon: number;
  };
  leads: {
    total: number;
    newCount: number;
    conversionRate: number;
  };
  club: {
    name: string;
    plan: string;
    saasStatus: string;
    studentsUsage: number;
    maxStudents: number;
  };
  alerts?: string[];
}

// Module cards configuration
const ADMIN_MODULES = [
  {
    key: 'marketplace',
    title: 'Маркетплейс',
    subtitle: 'Товари та замовлення',
    icon: 'storefront',
    color: '#E30613',
    bgColor: '#E3061320',
    route: '/admin/marketplace',
  },
  {
    key: 'billing',
    title: 'Billing',
    subtitle: 'Рахунки та оплати',
    icon: 'card',
    color: '#3B82F6',
    bgColor: '#3B82F620',
    route: '/admin/finance/invoices',
  },
  {
    key: 'subscriptions',
    title: 'Підписки',
    subtitle: 'Управління підписками',
    icon: 'repeat',
    color: '#7C3AED',
    bgColor: '#7C3AED20',
    route: '/admin/finance/subscriptions',
  },
  {
    key: 'plans',
    title: 'Тарифи',
    subtitle: 'Ціноутворення',
    icon: 'pricetag',
    color: '#22C55E',
    bgColor: '#22C55E20',
    route: '/admin/finance/plans',
  },
  {
    key: 'leads',
    title: 'Leads',
    subtitle: 'Потенційні клієнти',
    icon: 'people-circle',
    color: '#F59E0B',
    bgColor: '#F59E0B20',
    route: '/admin/leads',
    badge: 'leadsNew',
  },
  {
    key: 'saas',
    title: 'Клуби (SaaS)',
    subtitle: 'Multi-tenant',
    icon: 'business',
    color: '#EF4444',
    bgColor: '#EF444420',
    route: '/admin/tenants',
    badge: 'clubPlan',
  },
  {
    key: 'growth',
    title: 'Growth',
    subtitle: 'Аналітика росту',
    icon: 'trending-up',
    color: '#06B6D4',
    bgColor: '#06B6D420',
    route: '/admin/finance/analytics',
  },
  {
    key: 'automation',
    title: 'Automation',
    subtitle: 'Автоматичні правила',
    icon: 'flash',
    color: '#7C3AED',
    bgColor: '#7C3AED20',
    route: '/admin/automation',
  },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { activeClub } = useClub();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [economics, setEconomics] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch all data in parallel
      const [dashboardRes, leadsStats, clubDash, econRes] = await Promise.all([
        api.get('/admin/dashboard').catch(() => null),
        api.get('/admin/consultations/stats').catch(() => null),
        activeClub?.id ? api.get(`/admin/clubs/${activeClub.id}/dashboard`).catch(() => null) : null,
        api.get('/admin/economics').catch(() => null),
      ]);
      
      setEconomics(econRes);
      const dash = dashboardRes || {};
      const clubData = clubDash || {};
      const leads = leadsStats || {};

      setData({
        kpi: {
          totalStudents: dash.students?.total || clubData.stats?.students || 0,
          activeStudents: dash.students?.active || 0,
          coaches: dash.kpi?.coachesCount || clubData.stats?.coaches || 0,
          groups: clubData.stats?.groups || 0,
        },
        revenue: {
          collected: dash.revenue?.collected || clubData.stats?.monthlyRevenue || 0,
          expected: dash.revenue?.expected || 0,
          debt: dash.revenue?.debt || clubData.stats?.totalDebt || 0,
        },
        invoices: {
          paid: 0,
          pending: clubData.stats?.pendingInvoices || 0,
          overdue: clubData.stats?.overdueInvoices || 0,
          onReview: 0,
        },
        subscriptions: {
          active: dash.subscriptions?.active || clubData.stats?.activeSubs || 0,
          paused: dash.subscriptions?.paused || 0,
          renewalSoon: dash.subscriptions?.expiringSoon || 0,
        },
        leads: {
          total: leads.total || 0,
          newCount: leads.newCount || 0,
          conversionRate: leads.conversionRate || 0,
        },
        club: {
          name: activeClub?.name || clubData.club?.name || 'АТАКА',
          plan: activeClub?.plan || clubData.plan?.name || 'START',
          saasStatus: clubData.plan?.saasStatus || 'ACTIVE',
          studentsUsage: clubData.limits?.studentsUsage || 0,
          maxStudents: activeClub?.maxStudents || clubData.limits?.maxStudents || 50,
        },
        alerts: dash.alerts || [],
      });
    } catch (error) {
      console.log('Dashboard error:', error);
      setData({
        kpi: { totalStudents: 0, activeStudents: 0, coaches: 0, groups: 0 },
        revenue: { collected: 0, expected: 0, debt: 0 },
        invoices: { paid: 0, pending: 0, overdue: 0, onReview: 0 },
        subscriptions: { active: 0, paused: 0, renewalSoon: 0 },
        leads: { total: 0, newCount: 0, conversionRate: 0 },
        club: { name: 'АТАКА', plan: 'START', saasStatus: 'ACTIVE', studentsUsage: 0, maxStudents: 50 },
        alerts: [],
      });
    } finally {
      setLoading(false);
    }
  }, [activeClub]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const formatCurrency = (amount: number) => 
    amount >= 1000 ? `${Math.round(amount / 1000)}K ₴` : `${amount} ₴`;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Invoice Status Cards */}
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <View style={[styles.statusCard, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="checkmark-circle" size={20} color="#166534" />
              <Text style={[styles.statusValue, { color: '#166534' }]}>{data?.invoices.paid || 0}</Text>
              <Text style={styles.statusLabel}>Оплачено</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={20} color="#92400E" />
              <Text style={[styles.statusValue, { color: '#92400E' }]}>{data?.invoices.pending || 0}</Text>
              <Text style={styles.statusLabel}>Очікує</Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={[styles.statusCard, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={20} color="#991B1B" />
              <Text style={[styles.statusValue, { color: '#991B1B' }]}>{data?.invoices.overdue || 0}</Text>
              <Text style={styles.statusLabel}>Прострочено</Text>
            </View>
            <View style={[styles.statusCard, { backgroundColor: '#E0E7FF' }]}>
              <Ionicons name="eye" size={20} color="#3730A3" />
              <Text style={[styles.statusValue, { color: '#3730A3' }]}>{data?.invoices.onReview || 0}</Text>
              <Text style={styles.statusLabel}>На перевірці</Text>
            </View>
          </View>
        </View>

        {/* Revenue Summary */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Ionicons name="wallet" size={22} color="#fff" />
            <Text style={styles.revenueTitle}>Revenue</Text>
          </View>
          <Text style={styles.revenueAmount}>{formatCurrency(data?.revenue.collected || 0)}</Text>
          <View style={styles.revenueDetails}>
            <View style={styles.revenueDetail}>
              <Text style={styles.revenueDetailLabel}>Очікується</Text>
              <Text style={styles.revenueDetailValue}>{formatCurrency(data?.revenue.expected || 0)}</Text>
            </View>
            <View style={styles.revenueDivider} />
            <View style={styles.revenueDetail}>
              <Text style={styles.revenueDetailLabel}>Борг</Text>
              <Text style={[styles.revenueDetailValue, { color: '#FCA5A5' }]}>
                {formatCurrency(data?.revenue.debt || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Unit Economics */}
        {economics && (
          <View testID="unit-economics-block" style={styles.econCard}>
            <View style={styles.econHeader}>
              <Ionicons name="analytics" size={18} color="#7C3AED" />
              <Text style={styles.econTitle}>Unit Economics</Text>
              <View style={[styles.econHealthBadge, { backgroundColor: economics.health === 'excellent' ? '#16A34A' : economics.health === 'good' ? '#2563EB' : economics.health === 'warning' ? '#D97706' : '#DC2626' }]}>
                <Text style={styles.econHealthText}>
                  {economics.health === 'excellent' ? 'Відмінно' : economics.health === 'good' ? 'Добре' : economics.health === 'warning' ? 'Увага' : 'Критично'}
                </Text>
              </View>
            </View>
            
            <View style={styles.econMetrics}>
              <View style={styles.econMetric}>
                <Text style={styles.econMetricValue}>{formatCurrency(economics.ltv)}</Text>
                <Text style={styles.econMetricLabel}>LTV</Text>
              </View>
              <View style={styles.econDivider} />
              <View style={styles.econMetric}>
                <Text style={styles.econMetricValue}>{formatCurrency(economics.cac)}</Text>
                <Text style={styles.econMetricLabel}>CAC</Text>
              </View>
              <View style={styles.econDivider} />
              <View style={styles.econMetric}>
                <Text style={[styles.econMetricValue, { color: economics.ltvCacRatio >= 5 ? '#16A34A' : economics.ltvCacRatio >= 3 ? '#D97706' : '#DC2626' }]}>
                  {economics.ltvCacRatio}x
                </Text>
                <Text style={styles.econMetricLabel}>LTV/CAC</Text>
              </View>
            </View>

            {economics.coaches?.length > 0 && (
              <View style={styles.coachLeaderboard}>
                <Text style={styles.coachLeaderTitle}>Coach ROI</Text>
                {economics.coaches.map((c: any, i: number) => (
                  <View key={i} style={styles.coachRow}>
                    <View style={[styles.coachRank, { backgroundColor: i === 0 ? '#F59E0B' : '#E5E7EB' }]}>
                      <Text style={[styles.coachRankText, i === 0 && { color: '#fff' }]}>{i + 1}</Text>
                    </View>
                    <Text style={styles.coachName} numberOfLines={1}>{c.name}</Text>
                    <Text style={styles.coachRevenue}>{formatCurrency(c.revenue)}</Text>
                    <View style={[styles.coachRoiBadge, { backgroundColor: c.roi === 'high' ? '#DCFCE7' : c.roi === 'medium' ? '#FEF3C7' : '#FEE2E2' }]}>
                      <Text style={[styles.coachRoiText, { color: c.roi === 'high' ? '#166534' : c.roi === 'medium' ? '#92400E' : '#991B1B' }]}>
                        {c.roi === 'high' ? 'HIGH' : c.roi === 'medium' ? 'MED' : 'LOW'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {economics.alerts?.length > 0 && (
              <View style={styles.econAlerts}>
                {economics.alerts.map((a: any, i: number) => (
                  <View key={i} style={[styles.econAlert, { backgroundColor: a.type === 'critical' ? '#FEE2E2' : '#FEF3C7' }]}>
                    <Ionicons name={(a.icon || 'alert-circle') as any} size={14} color={a.type === 'critical' ? '#DC2626' : '#D97706'} />
                    <Text style={[styles.econAlertText, { color: a.type === 'critical' ? '#991B1B' : '#92400E' }]}>{a.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Club Context Banner */}
        {data?.club && (
          <Pressable 
            style={styles.clubBanner}
            onPress={() => router.push('/admin/tenants' as any)}
            testID="club-banner"
          >
            <View style={styles.clubBannerLeft}>
              <View style={styles.clubBannerLogo}>
                <Text style={styles.clubBannerLogoText}>{data.club.name?.charAt(0)}</Text>
              </View>
              <View>
                <Text style={styles.clubBannerName}>{data.club.name}</Text>
                <Text style={styles.clubBannerMeta}>
                  {data.kpi.coaches} тренерів • {data.kpi.totalStudents} учнів • {data.kpi.groups} груп
                </Text>
              </View>
            </View>
            <View style={[styles.clubPlanBadge, data.club.plan === 'PRO' ? styles.clubPlanPro : data.club.plan === 'ENTERPRISE' ? styles.clubPlanEnt : styles.clubPlanStart]}>
              <Text style={styles.clubPlanText}>{data.club.plan}</Text>
            </View>
          </Pressable>
        )}

        {/* Module Cards Grid */}
        <Text style={styles.sectionTitle}>Управління</Text>
        <View style={styles.modulesGrid}>
          {ADMIN_MODULES.map((module) => {
            const badge = module.badge === 'leadsNew' && data?.leads?.newCount 
              ? data.leads.newCount 
              : module.badge === 'clubPlan' && data?.club?.plan 
                ? data.club.plan 
                : null;

            return (
              <Pressable
                key={module.key}
                style={styles.moduleCard}
                onPress={() => router.push(module.route as any)}
                testID={`module-${module.key}`}
              >
                <View style={[styles.moduleIcon, { backgroundColor: module.bgColor }]}>
                  <Ionicons name={module.icon as any} size={26} color={module.color} />
                </View>
                <Text style={styles.moduleTitle}>{module.title}</Text>
                <Text style={styles.moduleSubtitle}>{module.subtitle}</Text>
                {badge !== null && (
                  <View style={[styles.moduleBadge, { backgroundColor: typeof badge === 'number' ? '#EF4444' : module.color + '20' }]}>
                    <Text style={[styles.moduleBadgeText, { color: typeof badge === 'number' ? '#fff' : module.color }]}>
                      {typeof badge === 'number' ? `+${badge}` : badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Leads Funnel (if leads exist) */}
        {(data?.leads?.total || 0) > 0 && (
          <Pressable onPress={() => router.push('/admin/leads' as any)} testID="leads-funnel">
            <Text style={styles.sectionTitle}>Воронка Leads</Text>
            <View style={styles.funnelCard}>
              <View style={styles.funnelRow}>
                <View style={styles.funnelItem}>
                  <Text style={[styles.funnelNum, { color: '#3B82F6' }]}>{data?.leads?.total || 0}</Text>
                  <Text style={styles.funnelLabel}>Всього</Text>
                </View>
                <View style={styles.funnelDivider} />
                <View style={styles.funnelItem}>
                  <Text style={[styles.funnelNum, { color: '#F59E0B' }]}>{data?.leads?.newCount || 0}</Text>
                  <Text style={styles.funnelLabel}>Нових</Text>
                </View>
                <View style={styles.funnelDivider} />
                <View style={styles.funnelItem}>
                  <Text style={[styles.funnelNum, { color: '#22C55E' }]}>{data?.leads?.conversionRate || 0}%</Text>
                  <Text style={styles.funnelLabel}>Конверсія</Text>
                </View>
              </View>
            </View>
          </Pressable>
        )}

        {/* Club Limits Usage */}
        {data?.club && (
          <>
            <Text style={styles.sectionTitle}>Ліміти тарифу</Text>
            <View style={styles.limitCard}>
              <View style={styles.limitHeader}>
                <Text style={styles.limitHeaderText}>Учні</Text>
                <Text style={styles.limitHeaderValue}>{data.kpi.totalStudents}/{data.club.maxStudents}</Text>
              </View>
              <View style={styles.limitBarBg}>
                <View style={[styles.limitBarFill, { 
                  width: `${Math.min(100, data.club.studentsUsage)}%`,
                  backgroundColor: data.club.studentsUsage > 80 ? '#EF4444' : data.club.studentsUsage > 50 ? '#F59E0B' : '#22C55E',
                }]} />
              </View>
              {data.club.studentsUsage > 70 && (
                <View style={styles.limitWarning}>
                  <Ionicons name="warning" size={14} color="#F59E0B" />
                  <Text style={styles.limitWarningText}>
                    {data.club.studentsUsage > 90 ? 'Ліміт майже вичерпано!' : 'Наближається до ліміту'}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Quick KPIs */}
        <Text style={styles.sectionTitle}>Ключові метрики</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{data?.kpi.activeStudents || 0}</Text>
            <Text style={styles.kpiLabel}>Активних учнів</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{data?.subscriptions.active || 0}</Text>
            <Text style={styles.kpiLabel}>Активних</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>{data?.subscriptions.renewalSoon || 0}</Text>
            <Text style={styles.kpiLabel}>Скоро</Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 16 },

  // Status Cards
  statusSection: { marginBottom: 16 },
  statusRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statusCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  statusValue: { fontSize: 20, fontWeight: '800' },
  statusLabel: { fontSize: 12, color: '#6B7280', flex: 1 },

  // Revenue Card
  revenueCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  revenueHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  revenueTitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  revenueAmount: { fontSize: 40, fontWeight: '800', color: '#fff', marginBottom: 16 },
  revenueDetails: { flexDirection: 'row', alignItems: 'center' },
  revenueDetail: { flex: 1 },
  revenueDetailLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  revenueDetailValue: { fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 2 },
  revenueDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 16 },

  // Section
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 12, marginLeft: 4 },

  // Modules Grid
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  moduleCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  moduleIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  moduleTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 4 },
  moduleSubtitle: { fontSize: 12, color: '#6B7280' },

  // KPI Row
  kpiRow: { flexDirection: 'row', gap: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  kpiLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  // Club Banner
  clubBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F0F10',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  clubBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  clubBannerLogo: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center' },
  clubBannerLogoText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  clubBannerName: { fontSize: 16, fontWeight: '700', color: '#fff' },
  clubBannerMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  clubPlanBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  clubPlanStart: { backgroundColor: '#374151' },
  clubPlanPro: { backgroundColor: '#7C3AED' },
  clubPlanEnt: { backgroundColor: '#B45309' },
  clubPlanText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  // Module Badge
  moduleBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  moduleBadgeText: { fontSize: 11, fontWeight: '700' },

  // Funnel
  funnelCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  funnelRow: { flexDirection: 'row', alignItems: 'center' },
  funnelItem: { flex: 1, alignItems: 'center' },
  funnelNum: { fontSize: 22, fontWeight: '800' },
  funnelLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  funnelDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },

  // Limits
  limitCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16 },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  limitHeaderText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  limitHeaderValue: { fontSize: 13, color: '#9CA3AF' },
  limitBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  limitBarFill: { height: 8, borderRadius: 4 },
  limitWarning: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  limitWarningText: { fontSize: 12, color: '#F59E0B', fontWeight: '500' },

  // Unit Economics
  econCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  econHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  econTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', flex: 1 },
  econHealthBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  econHealthText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  econMetrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 12, backgroundColor: '#F9FAFB', borderRadius: 12 },
  econMetric: { alignItems: 'center', flex: 1 },
  econMetricValue: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  econMetricLabel: { fontSize: 11, color: '#6B7280', marginTop: 2, fontWeight: '600' },
  econDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },
  coachLeaderboard: { marginTop: 14 },
  coachLeaderTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  coachRank: { width: 24, height: 24, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  coachRankText: { fontSize: 12, fontWeight: '800', color: '#374151' },
  coachName: { fontSize: 13, fontWeight: '600', color: '#0F0F10', flex: 1 },
  coachRevenue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  coachRoiBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  coachRoiText: { fontSize: 10, fontWeight: '800' },
  econAlerts: { marginTop: 12, gap: 6 },
  econAlert: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  econAlertText: { fontSize: 12, fontWeight: '600', flex: 1 },
});
