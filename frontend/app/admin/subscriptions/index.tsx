import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

type Subscription = {
  _id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  planName: string;
  price: number;
  nextBillingDate: string;
  childId?: { firstName: string; lastName: string };
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return '#22C55E';
    case 'PAUSED': return '#F59E0B';
    case 'CANCELLED': return '#EF4444';
    default: return '#6B7280';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Активна';
    case 'PAUSED': return 'Пауза';
    case 'CANCELLED': return 'Скасовано';
    default: return status;
  }
}

export default function AdminSubscriptionsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');

  const { data: subscriptions, isLoading, refetch } = useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: () => api.getSubscriptions(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateSubscription(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    },
  });

  const handleStatusChange = (id: string, newStatus: string) => {
    Alert.alert('Змінити статус?', `Новий статус: ${getStatusText(newStatus)}`, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Підтвердити', onPress: () => updateMutation.mutate({ id, status: newStatus }) },
    ]);
  };

  const filteredSubs = subscriptions?.filter((sub: Subscription) => {
    if (filter === 'all') return true;
    return sub.status === filter;
  }) || [];

  const filters = [
    { key: 'all', label: 'Всі' },
    { key: 'ACTIVE', label: 'Активні' },
    { key: 'PAUSED', label: 'Пауза' },
    { key: 'CANCELLED', label: 'Скасовані' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Підписки</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        <View style={styles.filters}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {filteredSubs.map((sub: Subscription) => (
          <View key={sub._id} style={styles.subCard}>
            <View style={styles.subHeader}>
              <View>
                <Text style={styles.subChild}>
                  {sub.childId?.firstName} {sub.childId?.lastName}
                </Text>
                <Text style={styles.subPlan}>{sub.planName}</Text>
              </View>
              <View style={styles.subRight}>
                <Text style={styles.subPrice}>{sub.price} грн/міс</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(sub.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(sub.status) }]}>
                    {getStatusText(sub.status)}
                  </Text>
                </View>
              </View>
            </View>

            {sub.nextBillingDate && sub.status === 'ACTIVE' && (
              <Text style={styles.nextBilling}>
                Наступна оплата: {format(parseISO(sub.nextBillingDate), 'd MMM yyyy', { locale: uk })}
              </Text>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              {sub.status === 'ACTIVE' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.pauseBtn]}
                  onPress={() => handleStatusChange(sub._id, 'PAUSED')}
                >
                  <Ionicons name="pause" size={16} color="#92400E" />
                  <Text style={[styles.actionText, { color: '#92400E' }]}>Pause</Text>
                </TouchableOpacity>
              )}
              {sub.status === 'PAUSED' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.resumeBtn]}
                  onPress={() => handleStatusChange(sub._id, 'ACTIVE')}
                >
                  <Ionicons name="play" size={16} color="#166534" />
                  <Text style={[styles.actionText, { color: '#166534' }]}>Resume</Text>
                </TouchableOpacity>
              )}
              {sub.status !== 'CANCELLED' && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.cancelBtn]}
                  onPress={() => handleStatusChange(sub._id, 'CANCELLED')}
                >
                  <Ionicons name="close" size={16} color="#991B1B" />
                  <Text style={[styles.actionText, { color: '#991B1B' }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {filteredSubs.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="refresh-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Немає підписок</Text>
          </View>
        )}
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
  filtersScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filters: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterBtnActive: {
    backgroundColor: '#0F0F10',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  subCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  subHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subChild: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F10',
  },
  subPlan: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  subRight: {
    alignItems: 'flex-end',
  },
  subPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F10',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  nextBilling: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  pauseBtn: {
    backgroundColor: '#FEF3C7',
  },
  resumeBtn: {
    backgroundColor: '#DCFCE7',
  },
  cancelBtn: {
    backgroundColor: '#FEE2E2',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
  },
});
