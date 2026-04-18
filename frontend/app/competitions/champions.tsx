import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { api } from '@/lib/api';

interface Champion {
  result: {
    _id: string;
    competitionId: string;
    childId: string;
    medal: string;
    place: number;
    awardType?: string;
  };
  child: {
    _id: string;
    firstName: string;
    lastName?: string;
    belt?: string;
  };
  competition: {
    _id: string;
    title: string;
    date: string;
  };
}

const MEDAL_CONFIG: Record<string, { emoji: string; bgColor: string; textColor: string }> = {
  GOLD: { emoji: '🥇', bgColor: '#FEF3C7', textColor: '#D97706' },
  SILVER: { emoji: '🥈', bgColor: '#F3F4F6', textColor: '#6B7280' },
  BRONZE: { emoji: '🥉', bgColor: '#FED7AA', textColor: '#C2410C' },
};

export default function ChampionsScreen() {
  const router = useRouter();
  const [champions, setChampions] = useState<Champion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChampions = async () => {
    try {
      const data = await api.getChampions(30);
      setChampions(data || []);
    } catch (error) {
      console.log('Failed to load champions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadChampions();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChampions();
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

  const renderChampion = ({ item, index }: { item: Champion; index: number }) => {
    const medalConfig = MEDAL_CONFIG[item.result.medal];
    const isTop3 = index < 3;

    return (
      <Animated.View style={[styles.card, isTop3 && styles.cardTop3]}>
        {/* Rank Number */}
        <View style={[styles.rankBadge, isTop3 && { backgroundColor: medalConfig?.bgColor || '#F3F4F6' }]}>
          <Text style={[styles.rankText, isTop3 && { color: medalConfig?.textColor || colors.text }]}>
            {index + 1}
          </Text>
        </View>

        {/* Medal */}
        <View style={styles.medalContainer}>
          <Text style={styles.medalEmoji}>{medalConfig?.emoji || '🏅'}</Text>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.championName}>
            {item.child?.firstName} {item.child?.lastName || ''}
          </Text>
          <Text style={styles.competitionTitle}>{item.competition?.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.placeText}>{item.result.place} місце</Text>
            <Text style={styles.separator}>•</Text>
            <Text style={styles.dateText}>{formatDate(item.competition?.date)}</Text>
          </View>
          {item.result.awardType && (
            <View style={styles.awardBadge}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={styles.awardText}>{item.result.awardType}</Text>
            </View>
          )}
        </View>

        {/* Belt Badge */}
        {item.child?.belt && (
          <View style={styles.beltBadge}>
            <Text style={styles.beltText}>{item.child.belt}</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const renderHeader = () => (
    <View style={styles.heroSection}>
      <View style={styles.trophyContainer}>
        <Text style={styles.trophyEmoji}>🏆</Text>
      </View>
      <Text style={styles.heroTitle}>Гордість клубу</Text>
      <Text style={styles.heroSubtitle}>
        Наші чемпіони та призери
      </Text>
    </View>
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
        <Text style={styles.headerTitle}>Чемпіони</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={champions}
        keyExtractor={(item) => item.result._id}
        renderItem={renderChampion}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Ще немає переможців</Text>
            <Text style={styles.emptyText}>
              Перші чемпіони з'являться після змагань
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
    textAlign: 'center',
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  trophyContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  trophyEmoji: {
    fontSize: 40,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  listContent: {
    paddingBottom: 32,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  cardTop3: {
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  medalContainer: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  medalEmoji: {
    fontSize: 32,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  championName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  competitionTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  placeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  separator: {
    fontSize: 12,
    color: colors.textTertiary,
    marginHorizontal: 6,
  },
  dateText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  awardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  awardText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  beltBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  beltText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
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
});
