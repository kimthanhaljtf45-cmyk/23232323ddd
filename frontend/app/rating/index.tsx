import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes } from '@/theme';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

type RatingItem = {
  childId: string;
  name: string;
  score: number;
  rank: number;
  belt: string;
  attendance: number;
  progress: number;
};

type GroupRating = {
  groupId: string;
  name: string;
  items: RatingItem[];
};

type ChildRating = {
  childId: string;
  name: string;
  score: number;
  attendanceScore: number;
  progressScore: number;
  tournamentScore: number;
  belt: string;
  rankInGroup?: number;
  totalInGroup?: number;
  rankInClub?: number;
  totalInClub?: number;
  movement?: number;
};

const beltColors: Record<string, string> = {
  WHITE: '#F5F5F5',
  YELLOW: '#FCD34D',
  ORANGE: '#FB923C',
  GREEN: '#22C55E',
  BLUE: '#3B82F6',
  BROWN: '#92400E',
  BLACK: '#1F2937'
};

const beltLabels: Record<string, string> = {
  WHITE: 'Білий',
  YELLOW: 'Жовтий',
  ORANGE: 'Помаранчевий',
  GREEN: 'Зелений',
  BLUE: 'Синій',
  BROWN: 'Коричневий',
  BLACK: 'Чорний'
};

export default function RatingScreen() {
  const { user, children } = useStore();
  const [activeTab, setActiveTab] = useState<'group' | 'club'>('group');
  const [myChildRating, setMyChildRating] = useState<ChildRating | null>(null);
  const [groupRating, setGroupRating] = useState<GroupRating | null>(null);
  const [clubRating, setClubRating] = useState<{ name: string; items: RatingItem[]; totalCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Get first child's rating if parent
      if (children.length > 0) {
        const child = children[0];
        const rating = await api.get(`/rating/child/${child.id}`);
        setMyChildRating(rating);
        
        // Get group rating if child has a group
        if (child.groupId) {
          const group = await api.get(`/rating/group/${child.groupId}`);
          setGroupRating(group);
        }
      }
      
      // Get club rating
      const club = await api.get('/rating/club');
      setClubRating(club);
    } catch (error) {
      console.error('Error loading ratings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Завантаження рейтингу...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentList = activeTab === 'group' ? groupRating?.items : clubRating?.items;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Рейтинг</Text>
          <Text style={styles.subtitle}>Дисципліна та розвиток</Text>
        </View>

        {/* My Child Rating Card */}
        {myChildRating && (
          <View style={styles.myRatingCard}>
            <View style={styles.myRatingHeader}>
              <Text style={styles.myRatingName}>{myChildRating.name}</Text>
              <View style={[styles.beltBadge, { backgroundColor: beltColors[myChildRating.belt] || '#F5F5F5' }]}>
                <Text style={[
                  styles.beltBadgeText,
                  myChildRating.belt === 'WHITE' && { color: colors.text }
                ]}>
                  {beltLabels[myChildRating.belt] || myChildRating.belt}
                </Text>
              </View>
            </View>
            
            <View style={styles.myRatingStats}>
              <View style={styles.myRatingStat}>
                <Text style={styles.myRatingRank}>#{myChildRating.rankInGroup || '-'}</Text>
                <Text style={styles.myRatingLabel}>у групі</Text>
              </View>
              <View style={styles.myRatingDivider} />
              <View style={styles.myRatingStat}>
                <Text style={styles.myRatingRank}>#{myChildRating.rankInClub || '-'}</Text>
                <Text style={styles.myRatingLabel}>у клубі</Text>
              </View>
              <View style={styles.myRatingDivider} />
              <View style={styles.myRatingStat}>
                <Text style={styles.myRatingScore}>{Math.round(myChildRating.score)}</Text>
                <Text style={styles.myRatingLabel}>балів</Text>
              </View>
            </View>

            {myChildRating.movement !== 0 && myChildRating.movement !== undefined && (
              <View style={[
                styles.movementBadge,
                myChildRating.movement > 0 ? styles.movementUp : styles.movementDown
              ]}>
                <Ionicons 
                  name={myChildRating.movement > 0 ? 'arrow-up' : 'arrow-down'} 
                  size={14} 
                  color={myChildRating.movement > 0 ? colors.success : colors.error} 
                />
                <Text style={[
                  styles.movementText,
                  { color: myChildRating.movement > 0 ? colors.success : colors.error }
                ]}>
                  {myChildRating.movement > 0 ? '+' : ''}{myChildRating.movement} позицій
                </Text>
              </View>
            )}

            {/* Score Breakdown */}
            <View style={styles.scoreBreakdown}>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Відвідування</Text>
                <Text style={styles.scoreValue}>{Math.round(myChildRating.attendanceScore)}%</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Прогрес</Text>
                <Text style={styles.scoreValue}>{Math.round(myChildRating.progressScore)}%</Text>
              </View>
              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>Турніри</Text>
                <Text style={styles.scoreValue}>{Math.round(myChildRating.tournamentScore)}%</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'group' && styles.tabActive]}
            onPress={() => setActiveTab('group')}
          >
            <Text style={[styles.tabText, activeTab === 'group' && styles.tabTextActive]}>
              Група
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'club' && styles.tabActive]}
            onPress={() => setActiveTab('club')}
          >
            <Text style={[styles.tabText, activeTab === 'club' && styles.tabTextActive]}>
              Клуб
            </Text>
          </TouchableOpacity>
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboard}>
          <Text style={styles.leaderboardTitle}>
            {activeTab === 'group' ? groupRating?.name || 'Група' : 'Клуб АТАКА'}
          </Text>

          {currentList && currentList.length > 0 ? (
            currentList.map((item, index) => (
              <RatingRow 
                key={item.childId} 
                item={item} 
                isMyChild={item.childId === myChildRating?.childId}
              />
            ))
          ) : (
            <View style={styles.emptyLeaderboard}>
              <Text style={styles.emptyText}>Немає даних</Text>
            </View>
          )}
        </View>

        {/* Motivation Message */}
        {myChildRating && myChildRating.rankInGroup && myChildRating.rankInGroup <= 3 && (
          <View style={styles.motivationCard}>
            <Ionicons name="trophy-outline" size={24} color={colors.warning} />
            <Text style={styles.motivationText}>
              Вітаємо! Ви у топ-3 групи!
            </Text>
          </View>
        )}

        {myChildRating && myChildRating.rankInGroup && myChildRating.rankInGroup > 3 && myChildRating.rankInGroup <= 5 && (
          <View style={styles.motivationCard}>
            <Ionicons name="trending-up-outline" size={24} color={colors.success} />
            <Text style={styles.motivationText}>
              Ви близько до топ-3!
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RatingRow({ item, isMyChild }: { item: RatingItem; isMyChild: boolean }) {
  const getRankStyle = (rank: number) => {
    if (rank === 1) return styles.rank1;
    if (rank === 2) return styles.rank2;
    if (rank === 3) return styles.rank3;
    return {};
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  return (
    <View style={[styles.ratingRow, isMyChild && styles.ratingRowHighlight]}>
      <View style={styles.ratingRowLeft}>
        <View style={[styles.rankBadge, getRankStyle(item.rank)]}>
          {getRankIcon(item.rank) ? (
            <Text style={styles.rankEmoji}>{getRankIcon(item.rank)}</Text>
          ) : (
            <Text style={styles.rankText}>{item.rank}</Text>
          )}
        </View>
        <View>
          <Text style={[styles.ratingName, isMyChild && styles.ratingNameHighlight]}>
            {item.name}
          </Text>
          <View style={styles.ratingMeta}>
            <View style={[styles.beltDot, { backgroundColor: beltColors[item.belt] || '#F5F5F5' }]} />
            <Text style={styles.ratingMetaText}>{item.attendance}% відв.</Text>
          </View>
        </View>
      </View>
      <Text style={[styles.ratingScore, isMyChild && styles.ratingScoreHighlight]}>
        {Math.round(item.score)}
      </Text>
    </View>
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
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginTop: 4,
  },
  myRatingCard: {
    margin: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  myRatingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  myRatingName: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
  },
  beltBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  beltBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
  myRatingStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  myRatingStat: {
    alignItems: 'center',
  },
  myRatingRank: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  myRatingScore: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  myRatingLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  myRatingDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  movementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginTop: spacing.md,
    gap: 4,
  },
  movementUp: {
    backgroundColor: '#DCFCE7',
  },
  movementDown: {
    backgroundColor: '#FEE2E2',
  },
  movementText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  scoreBreakdown: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  scoreValue: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: fontSizes.base,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  leaderboard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.md,
  },
  leaderboardTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ratingRowHighlight: {
    backgroundColor: `${colors.primary}10`,
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderBottomWidth: 0,
  },
  ratingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rank1: {
    backgroundColor: '#FEF3C7',
  },
  rank2: {
    backgroundColor: '#E5E7EB',
  },
  rank3: {
    backgroundColor: '#FED7AA',
  },
  rankText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  rankEmoji: {
    fontSize: 18,
  },
  ratingName: {
    fontSize: fontSizes.base,
    fontWeight: '500',
    color: colors.text,
  },
  ratingNameHighlight: {
    fontWeight: '700',
  },
  ratingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  beltDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  ratingMetaText: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
  },
  ratingScore: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  ratingScoreHighlight: {
    color: colors.primary,
  },
  emptyLeaderboard: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  motivationCard: {
    margin: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  motivationText: {
    flex: 1,
    fontSize: fontSizes.base,
    fontWeight: '500',
    color: colors.text,
  },
});
