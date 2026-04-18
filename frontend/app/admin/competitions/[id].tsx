import React, { useState, useCallback } from 'react';
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
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { api } from '@/lib/api';

export default function AdminCompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  
  const [competition, setCompetition] = useState<any>(null);
  const [kpiStats, setKpiStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [compData, statsData] = await Promise.all([
        api.getCompetition(id),
        api.getCompetitionDetailedStats(id),
      ]);
      setCompetition(compData);
      setKpiStats(statsData);
    } catch (error) {
      console.log('Failed to load competition:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateCompetition(id!, { status: newStatus });
      await loadData();
      Alert.alert('Успіх', 'Статус оновлено');
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося оновити статус');
    }
  };

  const handleConfirmParticipant = async (participantId: string) => {
    try {
      await api.updateParticipantStatus(id!, {
        participantId,
        status: 'CONFIRMED',
      });
      await loadData();
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося підтвердити учасника');
    }
  };

  const handleMarkPaid = async (participantId: string) => {
    try {
      await api.markParticipantPaid(participantId);
      await loadData();
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося позначити оплату');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string }> = {
      DRAFT: { label: 'Чернетка', color: '#6B7280', bg: '#F3F4F6' },
      OPEN: { label: 'Відкрито', color: '#10B981', bg: '#D1FAE5' },
      CLOSED: { label: 'Закрито', color: '#F59E0B', bg: '#FEF3C7' },
      FINISHED: { label: 'Завершено', color: '#6B7280', bg: '#F3F4F6' },
    };
    return configs[status] || configs.DRAFT;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!competition || !kpiStats) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Змагання не знайдено</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = getStatusConfig(competition.status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {competition.title}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <Text style={styles.dateText}>{formatDate(competition.date)}</Text>
        </View>

        {/* ===== KPI SECTION ===== */}
        <View style={styles.kpiSection}>
          <Text style={styles.sectionTitle}>📊 KPI Змагання</Text>
          
          {/* Revenue */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="wallet" size={20} color="#10B981" />
              <Text style={styles.kpiTitle}>Дохід</Text>
            </View>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                  {kpiStats.revenue.collected.toLocaleString()}
                </Text>
                <Text style={styles.kpiLabel}>Зібрано, грн</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiValue}>
                  {kpiStats.revenue.potential.toLocaleString()}
                </Text>
                <Text style={styles.kpiLabel}>Потенційно, грн</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
                  {kpiStats.revenue.missed.toLocaleString()}
                </Text>
                <Text style={styles.kpiLabel}>Втрачено, грн</Text>
              </View>
            </View>
          </View>

          {/* Participants */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="people" size={20} color="#6366F1" />
              <Text style={styles.kpiTitle}>Учасники</Text>
            </View>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiValue}>{kpiStats.participants.total}</Text>
                <Text style={styles.kpiLabel}>Всього</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                  {kpiStats.participants.confirmed}
                </Text>
                <Text style={styles.kpiLabel}>Підтверджено</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: '#F59E0B' }]}>
                  {kpiStats.participants.pending}
                </Text>
                <Text style={styles.kpiLabel}>Очікує</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                  {kpiStats.participants.paid}
                </Text>
                <Text style={styles.kpiLabel}>Оплачено</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
                  {kpiStats.participants.unpaid}
                </Text>
                <Text style={styles.kpiLabel}>Не оплачено</Text>
              </View>
            </View>
          </View>

          {/* Conversion */}
          <View style={styles.kpiCard}>
            <View style={styles.kpiHeader}>
              <Ionicons name="trending-up" size={20} color="#F59E0B" />
              <Text style={styles.kpiTitle}>Конверсія</Text>
            </View>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiItem}>
                <Text style={styles.kpiValue}>
                  {kpiStats.conversion.confirmationRate}%
                </Text>
                <Text style={styles.kpiLabel}>Підтвердження</Text>
              </View>
              <View style={styles.kpiItem}>
                <Text style={[
                  styles.kpiValue, 
                  { color: kpiStats.conversion.paymentRate >= 80 ? '#10B981' : kpiStats.conversion.paymentRate >= 50 ? '#F59E0B' : '#EF4444' }
                ]}>
                  {kpiStats.conversion.paymentRate}%
                </Text>
                <Text style={styles.kpiLabel}>Оплата</Text>
              </View>
            </View>
          </View>

          {/* Results (if finished) */}
          {kpiStats.results.total > 0 && (
            <View style={styles.kpiCard}>
              <View style={styles.kpiHeader}>
                <Ionicons name="trophy" size={20} color="#F59E0B" />
                <Text style={styles.kpiTitle}>Результати</Text>
              </View>
              <View style={styles.medalsRow}>
                <View style={styles.medalItem}>
                  <Text style={styles.medalEmoji}>🥇</Text>
                  <Text style={styles.medalCount}>{kpiStats.results.gold}</Text>
                </View>
                <View style={styles.medalItem}>
                  <Text style={styles.medalEmoji}>🥈</Text>
                  <Text style={styles.medalCount}>{kpiStats.results.silver}</Text>
                </View>
                <View style={styles.medalItem}>
                  <Text style={styles.medalEmoji}>🥉</Text>
                  <Text style={styles.medalCount}>{kpiStats.results.bronze}</Text>
                </View>
                <View style={styles.medalItem}>
                  <Text style={styles.medalEmoji}>🏅</Text>
                  <Text style={styles.medalCount}>{kpiStats.results.participation}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Participants List */}
        <View style={styles.participantsSection}>
          <Text style={styles.sectionTitle}>👥 Учасники</Text>
          
          {competition.participants?.length === 0 ? (
            <View style={styles.emptyParticipants}>
              <Ionicons name="people-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Поки немає учасників</Text>
            </View>
          ) : (
            competition.participants?.map((p: any, index: number) => (
              <View key={p._id || index} style={styles.participantCard}>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {p.child?.firstName || 'Учасник'} {p.child?.lastName || ''}
                  </Text>
                  <Text style={styles.participantMeta}>
                    {p.category || 'Без категорії'}
                  </Text>
                </View>
                
                <View style={styles.participantActions}>
                  {/* Status */}
                  {p.status === 'PENDING' ? (
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: '#D1FAE5' }]}
                      onPress={() => handleConfirmParticipant(p._id)}
                    >
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                      <Text style={[styles.actionChipText, { color: '#10B981' }]}>
                        Підтв.
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={[styles.statusChip, { backgroundColor: '#D1FAE5' }]}>
                      <Text style={{ color: '#10B981', fontSize: 11 }}>✓</Text>
                    </View>
                  )}
                  
                  {/* Payment */}
                  {!p.paid && competition.hasFee ? (
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: '#FEE2E2' }]}
                      onPress={() => handleMarkPaid(p._id)}
                    >
                      <Ionicons name="wallet-outline" size={14} color="#EF4444" />
                      <Text style={[styles.actionChipText, { color: '#EF4444' }]}>
                        Оплата
                      </Text>
                    </TouchableOpacity>
                  ) : competition.hasFee ? (
                    <View style={[styles.statusChip, { backgroundColor: '#D1FAE5' }]}>
                      <Ionicons name="wallet" size={12} color="#10B981" />
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Status Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>⚡ Дії</Text>
          
          <View style={styles.actionsGrid}>
            {competition.status === 'DRAFT' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#D1FAE5' }]}
                onPress={() => handleStatusChange('OPEN')}
              >
                <Ionicons name="lock-open" size={20} color="#10B981" />
                <Text style={[styles.actionButtonText, { color: '#10B981' }]}>
                  Відкрити реєстрацію
                </Text>
              </TouchableOpacity>
            )}
            
            {competition.status === 'OPEN' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#FEF3C7' }]}
                onPress={() => handleStatusChange('CLOSED')}
              >
                <Ionicons name="lock-closed" size={20} color="#D97706" />
                <Text style={[styles.actionButtonText, { color: '#D97706' }]}>
                  Закрити реєстрацію
                </Text>
              </TouchableOpacity>
            )}
            
            {competition.status === 'CLOSED' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#F3F4F6' }]}
                onPress={() => handleStatusChange('FINISHED')}
              >
                <Ionicons name="flag" size={20} color="#6B7280" />
                <Text style={[styles.actionButtonText, { color: '#6B7280' }]}>
                  Завершити змагання
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginLeft: 12,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // KPI Section
  kpiSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  kpiCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  kpiTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiItem: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  kpiLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  medalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  medalItem: {
    alignItems: 'center',
  },
  medalEmoji: {
    fontSize: 28,
  },
  medalCount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  // Participants
  participantsSection: {
    marginBottom: 20,
  },
  emptyParticipants: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  emptyText: {
    color: colors.textSecondary,
    marginTop: 12,
  },
  participantCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  participantMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  participantActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Actions
  actionsSection: {
    marginBottom: 20,
  },
  actionsGrid: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 10,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
