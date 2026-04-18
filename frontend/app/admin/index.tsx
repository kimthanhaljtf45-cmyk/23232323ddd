import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type MenuItem = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  color: string;
  value?: string | number;
};

export default function AdminDashboard() {
  const router = useRouter();

  const { data: billingStats, isLoading, refetch } = useQuery({
    queryKey: ['admin-billing-stats'],
    queryFn: () => api.getBillingStats(),
  });

  const menuItems: MenuItem[] = [
    {
      title: 'Маркетплейс',
      icon: 'storefront',
      route: '/admin/marketplace',
      color: '#E30613',
    },
    {
      title: 'Billing',
      icon: 'card',
      route: '/admin/billing',
      color: '#3B82F6',
      value: billingStats?.pendingCount || 0,
    },
    {
      title: 'Підписки',
      icon: 'refresh',
      route: '/admin/subscriptions',
      color: '#22C55E',
      value: billingStats?.activeSubscriptions || 0,
    },
    {
      title: 'Тарифи',
      icon: 'pricetag',
      route: '/admin/pricing',
      color: '#F59E0B',
    },
    {
      title: 'Leads',
      icon: 'people',
      route: '/admin/leads',
      color: '#8B5CF6',
    },
    {
      title: 'Клуби (SaaS)',
      icon: 'business',
      route: '/admin/tenants',
      color: '#EC4899',
    },
    {
      title: 'Знижки',
      icon: 'gift',
      route: '/admin/pricing/discounts',
      color: '#DC2626',
    },
    {
      title: 'Фінанси',
      icon: 'bar-chart',
      route: '/admin/finance',
      color: '#6366F1',
    },
    {
      title: 'Growth',
      icon: 'trending-up',
      route: '/admin/growth',
      color: '#10B981',
    },
    {
      title: 'Automation',
      icon: 'flash',
      route: '/admin/automation',
      color: '#7C3AED',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.statValue, { color: '#166534' }]}>
              {billingStats?.totalPaid?.toLocaleString() || 0} ₴
            </Text>
            <Text style={styles.statLabel}>Оплачено</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statValue, { color: '#92400E' }]}>
              {billingStats?.totalPending?.toLocaleString() || 0} ₴
            </Text>
            <Text style={styles.statLabel}>Очікує</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.statValue, { color: '#991B1B' }]}>
              {billingStats?.overdueCount || 0}
            </Text>
            <Text style={styles.statLabel}>Прострочено</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[styles.statValue, { color: '#1E40AF' }]}>
              {billingStats?.pendingReviewCount || 0}
            </Text>
            <Text style={styles.statLabel}>На перевірці</Text>
          </View>
        </View>

        {/* Menu Grid */}
        <Text style={styles.sectionTitle}>Управління</Text>
        <View style={styles.menuGrid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.menuCard}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
              </View>
              <Text style={styles.menuTitle}>{item.title}</Text>
              {item.value !== undefined && (
                <Text style={styles.menuValue}>{item.value}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginTop: 16,
    marginBottom: 12,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F10',
  },
  menuValue: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});
