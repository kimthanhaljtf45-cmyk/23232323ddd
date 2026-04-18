import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../../src/lib/api';

/**
 * ADMIN SUBSCRIPTIONS - Core Subscription Engine UI
 * 
 * Features:
 * - List all subscriptions with status
 * - Filter by status
 * - Actions: Upgrade, Pause, Resume, Cancel
 */

interface Subscription {
  id: string;
  studentName: string;
  planName: string;
  planType: string;
  status: string;
  finalPrice: number;
  startDate: string;
  endDate: string;
  groupName?: string;
  isFrozen: boolean;
  freezeDaysUsed: number;
  freezeDaysAllowed: number;
}

export default function AdminSubscriptionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    try {
      const response = await api.get('/admin/subscriptions');
      setSubscriptions(response || []);
    } catch (error) {
      console.log('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSubscriptions();
    setRefreshing(false);
  }, [fetchSubscriptions]);

  const handlePause = async (sub: Subscription) => {
    Alert.alert(
      'Заморозити підписку',
      `Заморозити підписку ${sub.studentName}?\nЗалишилось днів: ${sub.freezeDaysAllowed - sub.freezeDaysUsed}`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Заморозити',
          onPress: async () => {
            setActionLoading(sub.id);
            try {
              await api.put(`/admin/subscriptions/${sub.id}/pause`, { reason: 'По запиту адміна' });
              Alert.alert('Успіх', 'Підписка заморожена');
              fetchSubscriptions();
            } catch (error: any) {
              Alert.alert('Помилка', error.message || 'Не вдалося заморозити');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleResume = async (sub: Subscription) => {
    setActionLoading(sub.id);
    try {
      const result = await api.put(`/admin/subscriptions/${sub.id}/resume`);
      Alert.alert('Успіх', `Підписка відновлена. Новий кінець: ${new Date(result.newEndDate).toLocaleDateString('uk-UA')}`);
      fetchSubscriptions();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося відновити');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (sub: Subscription) => {
    Alert.alert(
      'Скасувати підписку',
      `Ви впевнені, що хочете скасувати підписку ${sub.studentName}?`,
      [
        { text: 'Ні', style: 'cancel' },
        {
          text: 'Скасувати',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(sub.id);
            try {
              await api.put(`/admin/subscriptions/${sub.id}/cancel`, { reason: 'Скасовано адміністратором' });
              Alert.alert('Успіх', 'Підписка скасована');
              fetchSubscriptions();
            } catch (error: any) {
              Alert.alert('Помилка', error.message || 'Не вдалося скасувати');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return '#22C55E';
      case 'PAUSED': return '#F59E0B';
      case 'CANCELLED': case 'EXPIRED': return '#EF4444';
      case 'RENEWAL_SOON': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Активна',
      PAUSED: 'Пауза',
      CANCELLED: 'Скасована',
      EXPIRED: 'Закінчилась',
      RENEWAL_SOON: 'Продовження',
    };
    return labels[status] || status;
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = { MONTH: '1 міс', HALF_YEAR: '6 міс', YEAR: '12 міс' };
    return labels[plan] || plan;
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('uk-UA');
  const formatCurrency = (amount: number) => amount.toLocaleString('uk-UA') + ' ₴';

  const filteredSubs = filter === 'all' 
    ? subscriptions 
    : subscriptions.filter(s => s.status === filter);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </Pressable>
        <Text style={styles.headerTitle}>Підписки</Text>
        <Pressable onPress={() => router.push('/admin/finance/create-subscription' as any)} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#7C3AED" />
        </Pressable>
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer} contentContainerStyle={styles.filters}>
        {[
          { key: 'all', label: 'Всі' },
          { key: 'ACTIVE', label: 'Активні' },
          { key: 'PAUSED', label: 'Пауза' },
          { key: 'RENEWAL_SOON', label: 'Продовження' },
          { key: 'EXPIRED', label: 'Закінчились' },
        ].map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#22C55E' }]}>{subscriptions.filter(s => s.status === 'ACTIVE').length}</Text>
            <Text style={styles.statLabel}>активних</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{subscriptions.filter(s => s.status === 'PAUSED').length}</Text>
            <Text style={styles.statLabel}>пауза</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#3B82F6' }]}>{subscriptions.filter(s => s.status === 'RENEWAL_SOON').length}</Text>
            <Text style={styles.statLabel}>продовжити</Text>
          </View>
        </View>

        {/* Subscriptions List */}
        {filteredSubs.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Немає підписок</Text>
          </View>
        ) : (
          filteredSubs.map((sub) => (
            <View key={sub.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>{sub.studentName}</Text>
                  <Text style={styles.cardSubtitle}>{sub.groupName || 'Без групи'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getStatusColor(sub.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(sub.status) }]}>
                    {getStatusLabel(sub.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardInfoLabel}>Тариф</Text>
                  <Text style={styles.cardInfoValue}>{sub.planName} ({getPlanLabel(sub.planType)})</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardInfoLabel}>Ціна</Text>
                  <Text style={[styles.cardInfoValue, { fontWeight: '700' }]}>{formatCurrency(sub.finalPrice)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardInfoLabel}>До</Text>
                  <Text style={styles.cardInfoValue}>{formatDate(sub.endDate)}</Text>
                </View>
              </View>

              {sub.status === 'PAUSED' && (
                <View style={styles.freezeInfo}>
                  <Ionicons name="snow" size={16} color="#F59E0B" />
                  <Text style={styles.freezeText}>
                    Заморожено • Використано {sub.freezeDaysUsed}/{sub.freezeDaysAllowed} днів
                  </Text>
                </View>
              )}

              <View style={styles.cardActions}>
                {sub.status === 'ACTIVE' && (
                  <>
                    <Pressable 
                      style={styles.cardAction}
                      onPress={() => handlePause(sub)}
                      disabled={actionLoading === sub.id}
                    >
                      <Ionicons name="pause" size={16} color="#F59E0B" />
                      <Text style={styles.cardActionText}>Пауза</Text>
                    </Pressable>
                    <Pressable style={styles.cardAction}>
                      <Ionicons name="arrow-up" size={16} color="#7C3AED" />
                      <Text style={styles.cardActionText}>Upgrade</Text>
                    </Pressable>
                  </>
                )}
                {sub.status === 'PAUSED' && (
                  <Pressable 
                    style={[styles.cardAction, { backgroundColor: '#22C55E20' }]}
                    onPress={() => handleResume(sub)}
                    disabled={actionLoading === sub.id}
                  >
                    {actionLoading === sub.id ? (
                      <ActivityIndicator size="small" color="#22C55E" />
                    ) : (
                      <>
                        <Ionicons name="play" size={16} color="#22C55E" />
                        <Text style={[styles.cardActionText, { color: '#22C55E' }]}>Відновити</Text>
                      </>
                    )}
                  </Pressable>
                )}
                {sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED' && (
                  <Pressable 
                    style={[styles.cardAction, { backgroundColor: '#FEE2E220' }]}
                    onPress={() => handleCancel(sub)}
                    disabled={actionLoading === sub.id}
                  >
                    <Ionicons name="close" size={16} color="#EF4444" />
                    <Text style={[styles.cardActionText, { color: '#EF4444' }]}>Скасувати</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  addButton: { padding: 8 },
  filtersContainer: { backgroundColor: '#fff', maxHeight: 60 },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#7C3AED' },
  filterText: { fontSize: 14, color: '#6B7280' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#0F0F10' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  cardSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardBody: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  cardInfo: {},
  cardInfoLabel: { fontSize: 11, color: '#9CA3AF' },
  cardInfoValue: { fontSize: 14, color: '#0F0F10', marginTop: 2 },
  freezeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF3C7', padding: 8, borderRadius: 8, marginBottom: 12 },
  freezeText: { fontSize: 12, color: '#92400E' },
  cardActions: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F3F4F6' },
  cardActionText: { fontSize: 12, fontWeight: '600', color: '#374151' },
});
