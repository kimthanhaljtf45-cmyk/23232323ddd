import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

/**
 * COACH LEADERBOARD — светлая тема, единая с owner/finance
 */

interface LeaderboardEntry {
  rank: number;
  coachId: string;
  name: string;
  score: number;
  level: string;
  groupsCount: number;
  studentsCount: number;
  fillRate: number;
  trend: 'up' | 'down' | 'stable';
  trendChange: number;
  isCurrentUser?: boolean;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  totalCoaches: number;
  lastUpdated: string;
}

export default function CoachLeaderboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<LeaderboardData | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await api.get('/coach/leaderboard');
      setData(response.data || response);
    } catch (error) {
      console.log('Leaderboard fetch error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankEmoji = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return '#10B981';
    if (score >= 80) return '#3B82F6';
    if (score >= 65) return '#F59E0B';
    return '#6B7280';
  };

  const getLevelStyle = (level: string) => {
    switch (level) {
      case 'ELITE':
        return { bg: '#FEF3C7', text: '#92400E' };
      case 'TOP':
        return { bg: '#DBEAFE', text: '#1E40AF' };
      case 'PRO':
        return { bg: '#D1FAE5', text: '#065F46' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.loadContainer} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const board = data?.leaderboard || [];
  const myRank = data?.myRank ?? null;
  const total = data?.totalCoaches ?? board.length;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Рейтинг тренерів</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchLeaderboard();
            }}
            tintColor="#E30613"
          />
        }
      >
        {/* MY RANK HERO */}
        {myRank !== null && (
          <View style={s.heroCard} testID="my-rank-hero">
            <View style={s.heroLeft}>
              <Text style={s.heroRank}>#{myRank}</Text>
              <Text style={s.heroEmoji}>{getRankEmoji(myRank)}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={s.heroTitle}>Ви в ТОПі клубу</Text>
              <Text style={s.heroSubtitle}>
                {total} тренер{total === 1 ? '' : total < 5 ? 'и' : 'ів'} · Місце {myRank} з {total}
              </Text>
            </View>
            <Ionicons name="trophy" size={28} color="#F59E0B" />
          </View>
        )}

        {/* LEADERBOARD */}
        <Text style={s.sectionLabel}>РЕЙТИНГ</Text>
        {board.length === 0 ? (
          <View style={s.emptyBox}>
            <Ionicons name="trophy-outline" size={40} color="#D1D5DB" />
            <Text style={s.emptyT}>Немає даних</Text>
          </View>
        ) : (
          board.map((entry) => {
            const levelStyle = getLevelStyle(entry.level);
            return (
              <View
                key={entry.coachId || entry.rank}
                style={[
                  s.entryCard,
                  entry.isCurrentUser && s.entryCardCurrent,
                ]}
                testID={`leaderboard-row-${entry.rank}`}
              >
                <View style={s.rankBadge}>
                  {entry.rank <= 3 ? (
                    <Text style={s.rankEmoji}>{getRankEmoji(entry.rank)}</Text>
                  ) : (
                    <Text style={s.rankNumber}>{entry.rank}</Text>
                  )}
                </View>

                <View style={s.coachInfo}>
                  <View style={s.coachNameRow}>
                    <Text
                      style={[
                        s.coachName,
                        entry.isCurrentUser && { color: '#E30613' },
                      ]}
                    >
                      {entry.name}
                    </Text>
                    {entry.isCurrentUser && <Text style={s.youLabel}>(Ви)</Text>}
                  </View>
                  <View style={s.coachMeta}>
                    <View style={[s.levelBadge, { backgroundColor: levelStyle.bg }]}>
                      <Text style={[s.levelText, { color: levelStyle.text }]}>
                        {entry.level}
                      </Text>
                    </View>
                    <Text style={s.coachStats}>
                      {entry.groupsCount} груп · {entry.studentsCount} учнів · {entry.fillRate}%
                    </Text>
                  </View>
                </View>

                <View style={s.scoreContainer}>
                  <Text style={[s.score, { color: getScoreColor(entry.score) }]}>
                    {entry.score}
                  </Text>
                  <Text
                    style={[
                      s.trend,
                      {
                        color:
                          entry.trendChange > 0
                            ? '#10B981'
                            : entry.trendChange < 0
                            ? '#EF4444'
                            : '#9CA3AF',
                      },
                    ]}
                  >
                    {entry.trendChange > 0
                      ? `▲ +${entry.trendChange}`
                      : entry.trendChange < 0
                      ? `▼ ${entry.trendChange}`
                      : '—'}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        {/* FORMULA INFO */}
        <Text style={s.sectionLabel}>ЯК РАХУЄТЬСЯ</Text>
        <View style={s.formulaCard}>
          <Text style={s.formulaText}>
            <Text style={s.formulaBold}>CoachScore</Text> = 40% attendance + 30% retention + 20% results + 10% actions
          </Text>
          <Text style={[s.formulaText, { marginTop: 6 }]}>
            + FillRate Bonus (до +5 за заповненість груп)
          </Text>
          <View style={s.levelLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#FEF3C7' }]} />
              <Text style={s.legendText}>ELITE 90+</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#DBEAFE' }]} />
              <Text style={s.legendText}>TOP 80+</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#D1FAE5' }]} />
              <Text style={s.legendText}>PRO 65+</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F0F10' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },

  // Hero
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  heroLeft: { alignItems: 'center', minWidth: 64 },
  heroRank: { fontSize: 28, fontWeight: '800', color: '#0F0F10' },
  heroEmoji: { fontSize: 20, marginTop: 2 },
  heroTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  heroSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Entry
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  entryCardCurrent: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBEB',
  },

  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankEmoji: { fontSize: 18 },
  rankNumber: { fontSize: 14, fontWeight: '800', color: '#6B7280' },

  coachInfo: { flex: 1 },
  coachNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coachName: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  youLabel: { fontSize: 12, color: '#E30613', fontWeight: '700' },
  coachMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  levelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  coachStats: { fontSize: 11, color: '#6B7280' },

  scoreContainer: { alignItems: 'flex-end', minWidth: 60 },
  score: { fontSize: 22, fontWeight: '800' },
  trend: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  emptyBox: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 40,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyT: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },

  // Formula
  formulaCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  formulaText: { fontSize: 13, color: '#374151', lineHeight: 20 },
  formulaBold: { fontWeight: '800', color: '#0F0F10' },
  levelLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
});
