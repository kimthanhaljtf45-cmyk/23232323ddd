import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * ADMIN FINANCE HUB
 * 
 * Overview + Quick access to:
 * - Subscriptions
 * - Invoices
 * - Plans
 * - Revenue
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
}

export default function AdminFinanceScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [subStats, setSubStats] = useState<SubscriptionStats>({ active: 0, paused: 0, renewalSoon: 0 });

  const fetchData = useCallback(async () => {
    try {
      const [revenueRes, subsRes] = await Promise.all([
        api.get('/admin/subscriptions/revenue').catch(() => null),
        api.get('/admin/subscriptions').catch(() => []),
      ]);

      setRevenue(revenueRes || {
        collected: 0,
        expected: 0,
        debt: 0,
        avgPerStudent: 0,
        invoicesPaid: 0,
        invoicesPending: 0,
        invoicesOverdue: 0,
      });

      const subs = subsRes || [];
      setSubStats({
        active: subs.filter((s: any) => s.status === 'ACTIVE').length,
        paused: subs.filter((s: any) => s.status === 'PAUSED').length,
        renewalSoon: subs.filter((s: any) => s.status === 'RENEWAL_SOON').length,
      });
    } catch (error) {
      console.log('Finance data error:', error);
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />}
      >
        {/* Revenue Card */}
        <View style={styles.revenueCard}>
          <Text style={styles.revenueTitle}>Revenue за місяць</Text>
          <View style={styles.revenueMain}>
            <Text style={styles.revenueAmount}>{formatCurrency(revenue?.collected || 0)}</Text>
            <Text style={styles.revenueSubtext}>
              зібрано з {formatCurrency((revenue?.collected || 0) + (revenue?.expected || 0) - (revenue?.collected || 0))} очікуваних
            </Text>
          </View>
          <View style={styles.revenueProgress}>
            <View style={[styles.revenueProgressBar, { 
              width: `${Math.min(100, ((revenue?.collected || 0) / ((revenue?.collected || 0) + (revenue?.expected || 0) || 1)) * 100)}%` 
            }]} />
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{formatCurrency(revenue?.debt || 0)}</Text>
            <Text style={styles.statLabel}>Борг</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatCurrency(revenue?.avgPerStudent || 0)}</Text>
            <Text style={styles.statLabel}>Сер. чек</Text>
          </View>
        </View>

        {/* Finance Modules */}
        <Text style={styles.sectionTitle}>Управління</Text>
        
        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/admin/finance/subscriptions' as any)}
        >
          <View style={[styles.moduleIcon, { backgroundColor: '#7C3AED20' }]}>
            <Ionicons name="card" size={24} color="#7C3AED" />
          </View>
          <View style={styles.moduleContent}>
            <Text style={styles.moduleTitle}>Підписки</Text>
            <Text style={styles.moduleSubtitle}>
              {subStats.active} активних • {subStats.paused} пауза • {subStats.renewalSoon} продовжити
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/admin/finance/invoices' as any)}
        >
          <View style={[styles.moduleIcon, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="document-text" size={24} color="#3B82F6" />
          </View>
          <View style={styles.moduleContent}>
            <Text style={styles.moduleTitle}>Рахунки</Text>
            <Text style={styles.moduleSubtitle}>
              {revenue?.invoicesPending || 0} очікують • {revenue?.invoicesOverdue || 0} прострочені
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable 
          style={styles.moduleCard}
          onPress={() => router.push('/admin/finance/plans' as any)}
        >
          <View style={[styles.moduleIcon, { backgroundColor: '#22C55E20' }]}>
            <Ionicons name="pricetag" size={24} color="#22C55E" />
          </View>
          <View style={styles.moduleContent}>
            <Text style={styles.moduleTitle}>Тарифи</Text>
            <Text style={styles.moduleSubtitle}>Місяць, 6 місяців, Рік</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <Pressable style={styles.moduleCard}>
          <View style={[styles.moduleIcon, { backgroundColor: '#F59E0B20' }]}>
            <Ionicons name="stats-chart" size={24} color="#F59E0B" />
          </View>
          <View style={styles.moduleContent}>
            <Text style={styles.moduleTitle}>Аналітика Revenue</Text>
            <Text style={styles.moduleSubtitle}>LTV, Forecast, Trends</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  // Revenue Card
  revenueCard: { backgroundColor: '#7C3AED', borderRadius: 20, padding: 20, marginBottom: 16 },
  revenueTitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  revenueMain: { marginTop: 8 },
  revenueAmount: { fontSize: 36, fontWeight: '800', color: '#fff' },
  revenueSubtext: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  revenueProgress: { height: 6, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, marginTop: 16 },
  revenueProgressBar: { height: 6, backgroundColor: '#fff', borderRadius: 3 },
  // Stats Grid
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  statValue: { fontSize: 20, fontWeight: '700', color: '#0F0F10' },
  statLabel: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  // Section
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginBottom: 12, marginLeft: 4 },
  // Module Card
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  moduleIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleContent: { flex: 1 },
  moduleTitle: { fontSize: 16, fontWeight: '600', color: '#0F0F10' },
  moduleSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
});
