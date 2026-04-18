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
import { colors } from '@/theme';
import { api } from '@/lib/api';

interface MyCompetition {
  participant: {
    _id: string;
    competitionId: string;
    childId: string;
    status: string;
    paid: boolean;
    category?: string;
  };
  competition: {
    _id: string;
    title: string;
    date: string;
    location: string;
    status: string;
  };
  child: {
    _id: string;
    firstName: string;
    lastName?: string;
  };
  result?: {
    medal: string;
    place: number;
    awardType?: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  PENDING: { label: 'Очікує', color: '#F59E0B', bgColor: '#FEF3C7' },
  CONFIRMED: { label: 'Підтверджено', color: '#10B981', bgColor: '#D1FAE5' },
  REJECTED: { label: 'Відхилено', color: '#EF4444', bgColor: '#FEE2E2' },
};

const MEDAL_CONFIG: Record<string, { emoji: string; label: string }> = {
  GOLD: { emoji: '🥇', label: 'Золото' },
  SILVER: { emoji: '🥈', label: 'Срібло' },
  BRONZE: { emoji: '🥉', label: 'Бронза' },
  PARTICIPATION: { emoji: '🏅', label: 'Участь' },
};

export default function MyCompetitionsScreen() {
  const router = useRouter();
  const [data, setData] = useState<MyCompetition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const response = await api.getMyCompetitions();
      setData(response || []);
    } catch (error) {
      console.log('Failed to load my competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderItem = ({ item }: { item: MyCompetition }) => {
    const statusConfig = STATUS_CONFIG[item.participant.status] || STATUS_CONFIG.PENDING;
    const hasResult = !!item.result;
    const medalConfig = item.result ? MEDAL_CONFIG[item.result.medal] : null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/competitions/${item.competition._id}`)}
        activeOpacity={0.7}
      >
        {/* Result Badge */}
        {hasResult && medalConfig && (
          <View style={styles.resultBadge}>
            <Text style={styles.resultEmoji}>{medalConfig.emoji}</Text>
            <Text style={styles.resultText}>
              {item.result!.place} місце
            </Text>
          </View>
        )}

        {/* Competition Title */}
        <Text style={styles.competitionTitle}>{item.competition.title}</Text>

        {/* Child Name */}
        <View style={styles.childRow}>
          <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.childName}>
            {item.child?.firstName} {item.child?.lastName || ''}
          </Text>
        </View>

        {/* Date and Location */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>{formatDate(item.competition.date)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.infoText}>{item.competition.location}</Text>
          </View>
        </View>

        {/* Status Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>

          {item.participant.paid ? (
            <View style={styles.paidBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={styles.paidText}>Оплачено</Text>
            </View>
          ) : (
            <View style={styles.unpaidBadge}>
              <Ionicons name="time-outline" size={14} color="#F59E0B" />
              <Text style={styles.unpaidText}>Оплата очікує</Text>
            </View>
          )}
        </View>

        {/* Category */}
        {item.participant.category && (
          <Text style={styles.categoryText}>
            Категорія: {item.participant.category}
          </Text>
        )}
      </TouchableOpacity>
    );
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Мої змагання</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.participant._id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Ви ще не брали участь</Text>
            <Text style={styles.emptyText}>
              Зареєструйтеся на найближчі змагання
            </Text>
            <TouchableOpacity
              style={styles.browseButton}
              onPress={() => router.push('/competitions')}
            >
              <Text style={styles.browseButtonText}>Переглянути змагання</Text>
            </TouchableOpacity>
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
    textAlign: 'center',
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
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 6,
  },
  resultEmoji: {
    fontSize: 18,
  },
  resultText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
  },
  competitionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  childName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paidText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10B981',
  },
  unpaidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  unpaidText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#F59E0B',
  },
  categoryText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
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
    textAlign: 'center',
  },
  browseButton: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
