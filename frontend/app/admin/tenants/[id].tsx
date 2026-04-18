import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type TenantPlan = 'START' | 'PRO' | 'AI';

interface Tenant {
  _id: string;
  slug: string;
  name: string;
  brandName?: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  plan: TenantPlan;
  isActive: boolean;
  studentsLimit: number;
  clubsLimit: number;
  coachesLimit: number;
  features: string[];
  priceMonthly: number;
  totalStudents: number;
  totalCoaches: number;
  totalRevenue: number;
  monthlyRevenue: number;
  ownerEmail?: string;
  ownerPhone?: string;
  address?: string;
  city?: string;
  createdAt: string;
  updatedAt: string;
}

const PLAN_COLORS: Record<TenantPlan, string> = {
  START: '#6B7280',
  PRO: '#3B82F6',
  AI: '#8B5CF6',
};

const PLAN_PRICES: Record<TenantPlan, number> = {
  START: 990,
  PRO: 2490,
  AI: 4990,
};

const FEATURE_LABELS: Record<string, string> = {
  basic_dashboard: 'Базова панель',
  attendance: 'Відвідуваність',
  payments: 'Платежі',
  messages: 'Повідомлення',
  competitions: 'Змагання',
  booking: 'Бронювання',
  discounts: 'Знижки',
  referrals: 'Реферали',
  retention: 'Retention',
  metabrain: 'MetaBrain AI',
  ltv: 'LTV Аналітика',
  predictive: 'Прогнози',
  growth: 'Growth Engine',
  white_label: 'White Label',
};

export default function TenantDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: tenant, isLoading, refetch } = useQuery<Tenant>({
    queryKey: ['tenant', id],
    queryFn: () => api.get(`/tenants/${id}`),
    enabled: !!id,
  });

  const upgradeMutation = useMutation({
    mutationFn: (plan: TenantPlan) => api.post(`/tenants/${id}/upgrade`, { plan }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: () => tenant?.isActive 
      ? api.post(`/tenants/${id}/deactivate`)
      : api.post(`/tenants/${id}/activate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });

  const handleUpgrade = (plan: TenantPlan) => {
    if (plan === tenant?.plan) return;
    
    Alert.alert(
      'Змінити план',
      `Змінити план на ${plan}?\nНова ціна: ${PLAN_PRICES[plan]} ₴/міс`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Підтвердити', onPress: () => upgradeMutation.mutate(plan) },
      ]
    );
  };

  const handleToggleActive = () => {
    const action = tenant?.isActive ? 'деактивувати' : 'активувати';
    Alert.alert(
      `${tenant?.isActive ? 'Деактивувати' : 'Активувати'} клуб`,
      `Ви впевнені, що хочете ${action} цей клуб?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Підтвердити', onPress: () => toggleActiveMutation.mutate() },
      ]
    );
  };

  const formatCurrency = (amount: number) => amount.toLocaleString('uk-UA') + ' ₴';
  const formatDate = (date: string) => new Date(date).toLocaleDateString('uk-UA');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#E30613" style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!tenant) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Клуб не знайдено</Text>
      </SafeAreaView>
    );
  }

  const usagePercent = {
    students: Math.round((tenant.totalStudents / tenant.studentsLimit) * 100),
    coaches: Math.round((tenant.totalCoaches / tenant.coachesLimit) * 100),
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{tenant.name}</Text>
        <TouchableOpacity onPress={handleToggleActive} style={styles.actionBtn}>
          <Ionicons 
            name={tenant.isActive ? 'pause-circle-outline' : 'play-circle-outline'} 
            size={24} 
            color={tenant.isActive ? '#F59E0B' : '#22C55E'} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Status & Plan Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: tenant.isActive ? '#DCFCE7' : '#FEE2E2' }]}>
              <View style={[styles.statusDot, { backgroundColor: tenant.isActive ? '#22C55E' : '#EF4444' }]} />
              <Text style={[styles.statusText, { color: tenant.isActive ? '#166534' : '#991B1B' }]}>
                {tenant.isActive ? 'Активний' : 'Неактивний'}
              </Text>
            </View>
            <View style={[styles.planChip, { backgroundColor: PLAN_COLORS[tenant.plan] }]}>
              <Text style={styles.planChipText}>{tenant.plan}</Text>
            </View>
          </View>

          <Text style={styles.cardTitle}>@{tenant.slug}</Text>
          {tenant.brandName && <Text style={styles.brandText}>Бренд: {tenant.brandName}</Text>}
          
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Тариф:</Text>
            <Text style={styles.priceValue}>{formatCurrency(tenant.priceMonthly)}/міс</Text>
          </View>
        </View>

        {/* Revenue Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💰 Фінанси</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{formatCurrency(tenant.monthlyRevenue)}</Text>
              <Text style={styles.statLabel}>Цей місяць</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#22C55E' }]}>{formatCurrency(tenant.totalRevenue)}</Text>
              <Text style={styles.statLabel}>Всього</Text>
            </View>
          </View>
        </View>

        {/* Usage Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📊 Використання</Text>
          
          <View style={styles.usageItem}>
            <View style={styles.usageHeader}>
              <Text style={styles.usageLabel}>Учні</Text>
              <Text style={styles.usageValue}>{tenant.totalStudents} / {tenant.studentsLimit}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(usagePercent.students, 100)}%`, backgroundColor: usagePercent.students > 90 ? '#EF4444' : '#22C55E' }]} />
            </View>
          </View>

          <View style={styles.usageItem}>
            <View style={styles.usageHeader}>
              <Text style={styles.usageLabel}>Тренери</Text>
              <Text style={styles.usageValue}>{tenant.totalCoaches} / {tenant.coachesLimit}</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(usagePercent.coaches, 100)}%`, backgroundColor: usagePercent.coaches > 90 ? '#EF4444' : '#3B82F6' }]} />
            </View>
          </View>
        </View>

        {/* Plan Upgrade Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📦 Змінити план</Text>
          <View style={styles.plansRow}>
            {(['START', 'PRO', 'AI'] as TenantPlan[]).map(plan => (
              <TouchableOpacity
                key={plan}
                style={[
                  styles.planCard,
                  tenant.plan === plan && { borderColor: PLAN_COLORS[plan], borderWidth: 2 },
                ]}
                onPress={() => handleUpgrade(plan)}
                disabled={upgradeMutation.isPending}
              >
                <View style={[styles.planBadge, { backgroundColor: PLAN_COLORS[plan] }]}>
                  <Text style={styles.planBadgeText}>{plan}</Text>
                </View>
                <Text style={styles.planPrice}>{formatCurrency(PLAN_PRICES[plan])}</Text>
                <Text style={styles.planPeriod}>/міс</Text>
                {tenant.plan === plan && (
                  <View style={styles.currentPlanBadge}>
                    <Text style={styles.currentPlanText}>Поточний</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Features Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🔧 Функції</Text>
          <View style={styles.featuresGrid}>
            {tenant.features.map(feature => (
              <View key={feature} style={styles.featureChip}>
                <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                <Text style={styles.featureText}>{FEATURE_LABELS[feature] || feature}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Contact Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📞 Контакти</Text>
          {tenant.ownerEmail && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={18} color="#6B7280" />
              <Text style={styles.contactText}>{tenant.ownerEmail}</Text>
            </View>
          )}
          {tenant.ownerPhone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={18} color="#6B7280" />
              <Text style={styles.contactText}>{tenant.ownerPhone}</Text>
            </View>
          )}
          {tenant.city && (
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <Text style={styles.contactText}>{tenant.city}</Text>
            </View>
          )}
          {tenant.address && (
            <View style={styles.contactRow}>
              <Ionicons name="home-outline" size={18} color="#6B7280" />
              <Text style={styles.contactText}>{tenant.address}</Text>
            </View>
          )}
        </View>

        {/* Branding Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🎨 Брендинг</Text>
          <View style={styles.brandingRow}>
            <View style={styles.colorBox}>
              <View style={[styles.colorSwatch, { backgroundColor: tenant.primaryColor }]} />
              <Text style={styles.colorLabel}>Primary</Text>
              <Text style={styles.colorValue}>{tenant.primaryColor}</Text>
            </View>
            <View style={styles.colorBox}>
              <View style={[styles.colorSwatch, { backgroundColor: tenant.secondaryColor }]} />
              <Text style={styles.colorLabel}>Secondary</Text>
              <Text style={styles.colorValue}>{tenant.secondaryColor}</Text>
            </View>
          </View>
        </View>

        {/* Meta Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📅 Мета</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Створено:</Text>
            <Text style={styles.metaValue}>{formatDate(tenant.createdAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Оновлено:</Text>
            <Text style={styles.metaValue}>{formatDate(tenant.updatedAt)}</Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>ID:</Text>
            <Text style={styles.metaValue}>{tenant._id}</Text>
          </View>
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
  actionBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginTop: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  planChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  planChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  brandText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22C55E',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F0F10',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  usageItem: {
    marginBottom: 16,
  },
  usageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  usageLabel: {
    fontSize: 14,
    color: '#374151',
  },
  usageValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F10',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  plansRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F0F10',
  },
  planPeriod: {
    fontSize: 10,
    color: '#6B7280',
  },
  currentPlanBadge: {
    marginTop: 8,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentPlanText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  featureText: {
    fontSize: 12,
    color: '#374151',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#374151',
  },
  brandingRow: {
    flexDirection: 'row',
    gap: 16,
  },
  colorBox: {
    flex: 1,
    alignItems: 'center',
  },
  colorSwatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginBottom: 8,
  },
  colorLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  colorValue: {
    fontSize: 11,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  metaValue: {
    fontSize: 13,
    color: '#374151',
  },
});
