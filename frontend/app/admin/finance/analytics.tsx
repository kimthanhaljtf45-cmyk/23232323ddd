import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

/**
 * ADMIN FINANCE ANALYTICS
 * 
 * Revenue metrics, trends, and forecasts
 */

interface RevenueData {
  collected: number;
  expected: number;
  debt: number;
  avgPerStudent: number;
  invoicesPaid: number;
  invoicesPending: number;
  invoicesOverdue: number;
}

interface SubscriptionStats {
  active: number;
  paused: number;
  renewalSoon: number;
  cancelled: number;
  expired: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function AdminFinanceAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [subStats, setSubStats] = useState<SubscriptionStats>({
    active: 0, paused: 0, renewalSoon: 0, cancelled: 0, expired: 0
  });

  const fetchData = useCallback(async () => {
    try {
      const [revenueRes, subsRes] = await Promise.all([
        api.get('/admin/subscriptions/revenue').catch(() => null),
        api.get('/admin/subscriptions').catch(() => []),
      ]);

      setRevenue(revenueRes || {
        collected: 0, expected: 0, debt: 0, avgPerStudent: 0,
        invoicesPaid: 0, invoicesPending: 0, invoicesOverdue: 0,
      });

      const subs = subsRes || [];
      setSubStats({
        active: subs.filter((s: any) => s.status === 'ACTIVE').length,
        paused: subs.filter((s: any) => s.status === 'PAUSED').length,
        renewalSoon: subs.filter((s: any) => s.status === 'RENEWAL_SOON').length,
        cancelled: subs.filter((s: any) => s.status === 'CANCELLED').length,
        expired: subs.filter((s: any) => s.status === 'EXPIRED').length,
      });
    } catch (error) {
      console.log('Analytics data error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const formatCurrency = (amount: number) => amount.toLocaleString('uk-UA') + ' ₴';

  // Calculate metrics
  const totalExpected = (revenue?.collected || 0) + (revenue?.expected || 0);
  const collectionRate = totalExpected > 0 ? ((revenue?.collected || 0) / totalExpected) * 100 : 0;
  const totalSubs = subStats.active + subStats.paused + subStats.renewalSoon;
  const churnRate = totalSubs > 0 ? ((subStats.cancelled + subStats.expired) / (totalSubs + subStats.cancelled + subStats.expired)) * 100 : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        {/* Main Revenue Card */}
        <View style={styles.revenueCard}>
          <Text style={styles.revenueTitle}>Revenue за місяць</Text>
          <View style={styles.revenueMain}>
            <Text style={styles.revenueAmount}>{formatCurrency(revenue?.collected || 0)}</Text>
            <Text style={styles.revenueSubtext}>з {formatCurrency(totalExpected)} очікуваних</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, collectionRate)}%` }]} />
          </View>
          <Text style={styles.collectionRate}>{collectionRate.toFixed(1)}% зібрано</Text>
        </View>

        {/* KPI Grid */}
        <Text style={styles.sectionTitle}>Ключові показники</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Ionicons name="wallet" size={24} color="#22C55E" />
            <Text style={styles.kpiValue}>{formatCurrency(revenue?.avgPerStudent || 0)}</Text>
            <Text style={styles.kpiLabel}>Середній чек</Text>
          </View>
          <View style={styles.kpiCard}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={[styles.kpiValue, { color: '#EF4444' }]}>{formatCurrency(revenue?.debt || 0)}</Text>
            <Text style={styles.kpiLabel}>Загальний борг</Text>
          </View>
          <View style={styles.kpiCard}>
            <Ionicons name="trending-down" size={24} color="#F59E0B" />
            <Text style={styles.kpiValue}>{churnRate.toFixed(1)}%</Text>
            <Text style={styles.kpiLabel}>Churn rate</Text>
          </View>
          <View style={styles.kpiCard}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.kpiValue}>{subStats.active}</Text>
            <Text style={styles.kpiLabel}>Активних</Text>
          </View>
        </View>

        {/* Subscription Breakdown */}
        <Text style={styles.sectionTitle}>Підписки по статусу</Text>
        <View style={styles.statusBreakdown}>
          <View style={styles.statusRow}>
            <View style={styles.statusLabel}>
              <View style={[styles.statusDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.statusText}>Активні</Text>
            </View>
            <Text style={styles.statusCount}>{subStats.active}</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusLabel}>
              <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.statusText}>Пауза</Text>
            </View>
            <Text style={styles.statusCount}>{subStats.paused}</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusLabel}>
              <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
              <Text style={styles.statusText}>Очікують продовження</Text>
            </View>
            <Text style={styles.statusCount}>{subStats.renewalSoon}</Text>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusLabel}>
              <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.statusText}>Скасовані / Закінчились</Text>
            </View>
            <Text style={styles.statusCount}>{subStats.cancelled + subStats.expired}</Text>
          </View>
        </View>

        {/* Invoice Stats */}
        <Text style={styles.sectionTitle}>Рахунки</Text>
        <View style={styles.invoiceStats}>
          <View style={[styles.invoiceStat, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.invoiceStatValue, { color: '#166534' }]}>{revenue?.invoicesPaid || 0}</Text>
            <Text style={styles.invoiceStatLabel}>Оплачено</Text>
          </View>
          <View style={[styles.invoiceStat, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.invoiceStatValue, { color: '#92400E' }]}>{revenue?.invoicesPending || 0}</Text>
            <Text style={styles.invoiceStatLabel}>Очікують</Text>
          </View>
          <View style={[styles.invoiceStat, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.invoiceStatValue, { color: '#991B1B' }]}>{revenue?.invoicesOverdue || 0}</Text>
            <Text style={styles.invoiceStatLabel}>Прострочено</Text>
          </View>
        </View>

        {/* LTV Notice */}
        <View style={styles.ltvNotice}>
          <Ionicons name="bulb" size={20} color="#7C3AED" />
          <View style={styles.ltvContent}>
            <Text style={styles.ltvTitle}>LTV Engine</Text>
            <Text style={styles.ltvText}>
              Система автоматично розраховує LTV кожного учня та оптимізує знижки на основі прогнозу доходу.
            </Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  // Revenue Card
  revenueCard: { backgroundColor: '#7C3AED', borderRadius: 20, padding: 20, marginBottom: 20 },
  revenueTitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  revenueMain: { marginTop: 8 },
  revenueAmount: { fontSize: 36, fontWeight: '800', color: '#fff' },
  revenueSubtext: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  progressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 4, marginTop: 16 },
  progressFill: { height: 8, backgroundColor: '#fff', borderRadius: 4 },
  collectionRate: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 8, textAlign: 'right' },
  // Section
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12, marginTop: 8 },
  // KPI Grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  kpiCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 20, fontWeight: '700', color: '#0F0F10', marginTop: 8 },
  kpiLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  // Status Breakdown
  statusBreakdown: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  statusLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, color: '#374151' },
  statusCount: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  // Invoice Stats
  invoiceStats: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  invoiceStat: { flex: 1, borderRadius: 12, padding: 16, alignItems: 'center' },
  invoiceStatValue: { fontSize: 24, fontWeight: '700' },
  invoiceStatLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  // LTV Notice
  ltvNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F5F3FF',
    borderRadius: 16,
    padding: 16,
  },
  ltvContent: { flex: 1 },
  ltvTitle: { fontSize: 14, fontWeight: '700', color: '#7C3AED', marginBottom: 4 },
  ltvText: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
});
