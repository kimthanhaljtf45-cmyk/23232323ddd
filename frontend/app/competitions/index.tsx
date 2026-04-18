import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { api } from '@/lib/api';

interface Competition {
  _id: string;
  title: string;
  description?: string;
  date: string;
  location: string;
  programType: string;
  registrationDeadline: string;
  hasFee: boolean;
  feeAmount?: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINISHED';
}

const PROGRAM_LABELS: Record<string, string> = {
  KIDS: 'Дитяча',
  SPECIAL: 'Особлива',
  SELF_DEFENSE: 'Самооборона',
  MENTORSHIP: 'Персональні',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Чернетка', color: '#6B7280', bgColor: '#F3F4F6' },
  OPEN: { label: 'Реєстрація відкрита', color: '#10B981', bgColor: '#D1FAE5' },
  CLOSED: { label: 'Реєстрацію закрито', color: '#F59E0B', bgColor: '#FEF3C7' },
  FINISHED: { label: 'Завершено', color: '#6B7280', bgColor: '#F3F4F6' },
};

export default function CompetitionsListScreen() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const loadCompetitions = async () => {
    try {
      const data = await api.getCompetitions(filter ? { status: filter } : undefined);
      setCompetitions(data || []);
    } catch (error) {
      console.log('Failed to load competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCompetitions();
    }, [filter])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetitions();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isDeadlineSoon = (deadline: string) => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diff = deadlineDate.getTime() - today.getTime();
    const days = diff / (1000 * 60 * 60 * 24);
    return days <= 3 && days > 0;
  };

  const renderCompetitionCard = ({ item }: { item: Competition }) => {
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.DRAFT;
    const deadlineSoon = isDeadlineSoon(item.registrationDeadline);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/competitions/${item._id}`)}
        activeOpacity={0.7}
      >
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.cardTitle}>{item.title}</Text>

        {/* Info Row */}
        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>{formatDate(item.date)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>{item.location}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="fitness-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.infoText}>{PROGRAM_LABELS[item.programType] || item.programType}</Text>
        </View>

        {/* Fee */}
        {item.hasFee && item.feeAmount && (
          <View style={styles.feeContainer}>
            <Ionicons name="wallet-outline" size={16} color="#EF4444" />
            <Text style={styles.feeText}>Внесок: {item.feeAmount} грн</Text>
          </View>
        )}

        {/* Deadline Warning */}
        {item.status === 'OPEN' && deadlineSoon && (
          <View style={styles.deadlineWarning}>
            <Ionicons name="time-outline" size={14} color="#F59E0B" />
            <Text style={styles.deadlineText}>
              Реєстрація до {formatDate(item.registrationDeadline)}
            </Text>
          </View>
        )}

        {/* Arrow */}
        <View style={styles.arrowContainer}>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderFilterButton = (status: string | null, label: string) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === status && styles.filterButtonActive]}
      onPress={() => setFilter(status)}
    >
      <Text style={[styles.filterButtonText, filter === status && styles.filterButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Змагання</Text>
        <TouchableOpacity
          onPress={() => router.push('/competitions/champions')}
          style={styles.championsButton}
        >
          <Ionicons name="trophy" size={22} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {renderFilterButton(null, 'Всі')}
        {renderFilterButton('OPEN', 'Відкриті')}
        {renderFilterButton('FINISHED', 'Завершені')}
      </View>

      {/* List */}
      <FlatList
        data={competitions}
        keyExtractor={(item) => item._id}
        renderItem={renderCompetitionCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Змагань немає</Text>
            <Text style={styles.emptyText}>
              Слідкуйте за оновленнями
            </Text>
          </View>
        }
      />
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
  },
  championsButton: {
    padding: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  feeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 6,
  },
  feeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  deadlineWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    gap: 6,
  },
  deadlineText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#D97706',
  },
  arrowContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
});
