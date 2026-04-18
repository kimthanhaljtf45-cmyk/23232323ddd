import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';

/**
 * COACH PROFILE - ПОВНИЙ ПРОФІЛЬ ТРЕНЕРА
 * 
 * Coach Score + KPI Breakdown + Динаміка
 * Групи тренера
 * Учні (загальна кількість)
 * Історія тренувань
 * Виконані дії
 * Logout
 */

interface CoachProfileData {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  avatarUrl?: string;
  specialization: string[];
  experience: string;
  kpi: {
    coachScore: number;
    breakdown: {
      attendance: number;
      retention: number;
      results: number;
      actions: number;
    };
    trend: string;
    trendChange: number;
    level: string;
  };
  kpiDynamics: Array<{ week: string; score: number }>;
  stats: {
    groupsCount: number;
    studentsCount: number;
    trainingsThisMonth: number;
    actionsCompleted: number;
    actionsTotal: number;
  };
  groups: Array<{
    id: string;
    name: string;
    ageRange: string;
    studentsCount: number;
    healthScore: number;
    healthStatus: string;
  }>;
  trainingHistory: Array<{
    date: string;
    attended: number;
    absent: number;
    total: number;
    rate: number;
  }>;
  // NEW: Rank info
  rank?: {
    position: number;
    totalCoaches: number;
    percentile: number;
    nextLevelAt: number | null;
    pointsToNextLevel: number;
    badge: string;
  };
}

export default function CoachProfileScreen() {
  const router = useRouter();
  const { user, logout } = useStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<CoachProfileData | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      // Use profile-full endpoint that includes rank
      const response = await api.get('/coach/profile-full');
      setProfile(response);
    } catch (error) {
      console.log('Profile fetch error:', error);
      // Use basic user data from store, show empty stats
      // No mock KPI data - will be calculated from real backend
      setProfile({
        id: user?.id || '',
        firstName: user?.firstName || 'Тренер',
        lastName: user?.lastName || '',
        phone: user?.phone || '',
        avatarUrl: user?.avatarUrl || undefined,
        role: 'Тренер',
        specialization: [],
        experience: '—',
        kpi: {
          coachScore: 0,
          breakdown: { attendance: 0, retention: 0, results: 0, actions: 0 },
          trend: 'stable',
          trendChange: 0,
          level: 'BEGINNER',
        },
        kpiDynamics: [],
        stats: {
          groupsCount: 0,
          studentsCount: 0,
          trainingsThisMonth: 0,
          actionsCompleted: 0,
          actionsTotal: 0,
        },
        groups: [],
        trainingHistory: [],
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }, [fetchProfile]);

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#22C55E';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getLevelLabel = (level: string): string => {
    switch (level) {
      case 'ELITE': return 'ELITE';
      case 'TOP': return 'TOP';
      case 'PRO': return 'PRO';
      default: return 'BEGINNER';
    }
  };

  const getHealthColor = (score: number): string => {
    if (score >= 75) return '#22C55E';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const handleLogout = () => {
    Alert.alert(
      'Вихід',
      'Ви впевнені, що хочете вийти?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Вийти',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              router.replace('/');
            } catch (e) {
              console.log('Logout error:', e);
              router.replace('/');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) return null;

  const scoreColor = getScoreColor(profile.kpi.coachScore);
  const actionsPercent = profile.stats.actionsTotal > 0
    ? Math.round((profile.stats.actionsCompleted / profile.stats.actionsTotal) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Профіль тренера',
          headerStyle: { backgroundColor: '#fff' },
          headerLeft: () => (
            <Pressable 
              onPress={() => {
                // Try back first, fallback to coach dashboard
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/coach');
                }
              }} 
              style={styles.headerBtn}
            >
              <Ionicons name="chevron-back" size={24} color="#0F0F10" />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
      >
        {/* IDENTITY */}
        <View style={styles.identityCard}>
          {profile.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>
                {(profile.firstName?.[0] || 'T')}{(profile.lastName?.[0] || '')}
              </Text>
            </View>
          )}
          <Text style={styles.profileName}>
            {profile.firstName} {profile.lastName}
          </Text>
          <Text style={styles.profileRole}>{profile.role}</Text>
          <View style={styles.specRow}>
            {profile.specialization.map((spec, i) => (
              <View key={i} style={styles.specBadge}>
                <Text style={styles.specText}>{spec}</Text>
              </View>
            ))}
          </View>
          {profile.experience && profile.experience !== '—' && (
            <Text style={styles.experience}>Досвід: {profile.experience}</Text>
          )}
        </View>

        {/* RANK CARD - Link to Leaderboard */}
        {profile.rank && (
          <Pressable 
            style={styles.rankCard}
            onPress={() => router.push('/coach/leaderboard')}
          >
            <View style={styles.rankLeft}>
              <Text style={styles.rankBadgeEmoji}>{profile.rank.badge || '🏆'}</Text>
              <View>
                <Text style={styles.rankTitle}>Ви #{profile.rank.position} в клубі</Text>
                <Text style={styles.rankSubtitle}>
                  з {profile.rank.totalCoaches} тренерів · Топ {profile.rank.percentile}%
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        )}

        {/* COACH SCORE + KPI */}
        <View style={styles.kpiCard}>
          <View style={styles.kpiHeader}>
            <View>
              <Text style={styles.kpiTitle}>Coach Score</Text>
              <View style={styles.levelRow}>
                <Text style={styles.levelText}>{getLevelLabel(profile.kpi.level)}</Text>
                {profile.kpi.trendChange !== 0 && (
                  <View style={[
                    styles.trendBadge,
                    { backgroundColor: profile.kpi.trendChange > 0 ? '#D1FAE5' : '#FEE2E2' }
                  ]}>
                    <Ionicons
                      name={profile.kpi.trendChange > 0 ? 'trending-up' : 'trending-down'}
                      size={14}
                      color={profile.kpi.trendChange > 0 ? '#22C55E' : '#EF4444'}
                    />
                    <Text style={[
                      styles.trendText,
                      { color: profile.kpi.trendChange > 0 ? '#065F46' : '#991B1B' }
                    ]}>
                      {profile.kpi.trendChange > 0 ? '+' : ''}{profile.kpi.trendChange}
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: scoreColor }]}>
              <Text style={styles.scoreValue}>{profile.kpi.coachScore}</Text>
            </View>
          </View>

          {/* KPI Breakdown */}
          <View style={styles.breakdownGrid}>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownBar, { backgroundColor: '#22C55E20' }]}>
                <View style={[
                  styles.breakdownFill,
                  { width: `${profile.kpi.breakdown.attendance}%`, backgroundColor: '#22C55E' }
                ]} />
              </View>
              <Text style={styles.breakdownValue}>{profile.kpi.breakdown.attendance}%</Text>
              <Text style={styles.breakdownLabel}>Attendance</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownBar, { backgroundColor: '#3B82F620' }]}>
                <View style={[
                  styles.breakdownFill,
                  { width: `${profile.kpi.breakdown.retention}%`, backgroundColor: '#3B82F6' }
                ]} />
              </View>
              <Text style={styles.breakdownValue}>{profile.kpi.breakdown.retention}%</Text>
              <Text style={styles.breakdownLabel}>Retention</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownBar, { backgroundColor: '#F59E0B20' }]}>
                <View style={[
                  styles.breakdownFill,
                  { width: `${profile.kpi.breakdown.results}%`, backgroundColor: '#F59E0B' }
                ]} />
              </View>
              <Text style={styles.breakdownValue}>{profile.kpi.breakdown.results}%</Text>
              <Text style={styles.breakdownLabel}>Results</Text>
            </View>
            <View style={styles.breakdownItem}>
              <View style={[styles.breakdownBar, { backgroundColor: '#8B5CF620' }]}>
                <View style={[
                  styles.breakdownFill,
                  { width: `${profile.kpi.breakdown.actions}%`, backgroundColor: '#8B5CF6' }
                ]} />
              </View>
              <Text style={styles.breakdownValue}>{profile.kpi.breakdown.actions}%</Text>
              <Text style={styles.breakdownLabel}>Actions</Text>
            </View>
          </View>

          {/* Dynamics */}
          {profile.kpiDynamics.length > 0 && (
            <View style={styles.dynamicsSection}>
              <Text style={styles.dynamicsTitle}>Динаміка</Text>
              <View style={styles.dynamicsRow}>
                {profile.kpiDynamics.map((d, i) => (
                  <View key={i} style={styles.dynamicsItem}>
                    <View style={[
                      styles.dynamicsBar,
                      {
                        height: Math.max(20, (d.score / 100) * 60),
                        backgroundColor: getScoreColor(d.score),
                      }
                    ]} />
                    <Text style={styles.dynamicsScore}>{d.score}</Text>
                    <Text style={styles.dynamicsWeek} numberOfLines={1}>
                      {d.week.replace('тижні тому', 'тиж.').replace('тиждень', 'тиж.')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          
          <Text style={styles.kpiFormula}>
            = 40% attendance + 30% retention + 20% results + 10% actions
          </Text>
        </View>

        {/* QUICK STATS */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{profile.stats.groupsCount}</Text>
            <Text style={styles.statLabel}>Групи</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="person" size={24} color="#22C55E" />
            <Text style={styles.statValue}>{profile.stats.studentsCount}</Text>
            <Text style={styles.statLabel}>Учнів</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="fitness" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{profile.stats.trainingsThisMonth}</Text>
            <Text style={styles.statLabel}>Тренувань</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done" size={24} color="#8B5CF6" />
            <Text style={styles.statValue}>{actionsPercent}%</Text>
            <Text style={styles.statLabel}>Дії ({profile.stats.actionsCompleted}/{profile.stats.actionsTotal})</Text>
          </View>
        </View>

        {/* GROUPS */}
        {profile.groups.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Мої групи</Text>
            {profile.groups.map((group) => (
              <Pressable
                key={group.id}
                style={styles.groupCard}
                onPress={() => router.push(`/coach/group/${group.id}`)}
              >
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMeta}>
                    {group.ageRange} · {group.studentsCount} учнів
                  </Text>
                </View>
                <View style={styles.groupHealth}>
                  <View style={[
                    styles.healthDot,
                    { backgroundColor: getHealthColor(group.healthScore) }
                  ]} />
                  <Text style={[
                    styles.healthText,
                    { color: getHealthColor(group.healthScore) }
                  ]}>
                    {group.healthScore}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </Pressable>
            ))}
          </View>
        )}

        {/* TRAINING HISTORY */}
        {profile.trainingHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Історія тренувань</Text>
            {profile.trainingHistory.slice(0, 10).map((t, i) => (
              <View key={i} style={styles.historyItem}>
                <Text style={styles.historyDate}>
                  {new Date(t.date).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}
                </Text>
                <View style={styles.historyBar}>
                  <View style={[
                    styles.historyFill,
                    { width: `${t.rate}%`, backgroundColor: t.rate >= 80 ? '#22C55E' : t.rate >= 60 ? '#F59E0B' : '#EF4444' }
                  ]} />
                </View>
                <Text style={styles.historyRate}>
                  {t.attended}/{t.total} ({t.rate}%)
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* SETTINGS / LOGOUT */}
        <View style={styles.settingsSection}>
          <Pressable style={styles.settingsItem} onPress={() => router.push('/coach/settings')}>
            <Ionicons name="settings-outline" size={22} color="#0F0F10" />
            <Text style={styles.settingsText}>Налаштування профілю</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.settingsItem} onPress={() => router.push('/coach/settings')}>
            <Ionicons name="notifications-outline" size={22} color="#0F0F10" />
            <Text style={styles.settingsText}>Сповіщення</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={styles.settingsItem} onPress={() => router.push('/coach/settings')}>
            <Ionicons name="time-outline" size={22} color="#0F0F10" />
            <Text style={styles.settingsText}>Робочий графік</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable style={[styles.settingsItem, styles.logoutItem]} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text style={styles.logoutText}>Вийти</Text>
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBtn: { padding: 4 },
  scrollView: { flex: 1 },
  content: { padding: 16 },

  // Identity
  identityCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0F0F10',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 16,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#fff' },
  profileName: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  profileRole: { fontSize: 15, color: '#6B7280', marginTop: 4 },
  specRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  specBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  specText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  experience: { fontSize: 14, color: '#6B7280', marginTop: 12 },

  // Rank Card
  rankCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rankLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rankBadgeEmoji: { fontSize: 32 },
  rankTitle: { fontSize: 16, fontWeight: '700', color: '#92400E' },
  rankSubtitle: { fontSize: 13, color: '#B45309', marginTop: 2 },

  // KPI
  kpiCard: {
    backgroundColor: '#0F0F10',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  kpiTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  levelText: { fontSize: 13, fontWeight: '700', color: '#9CA3AF' },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trendText: { fontSize: 12, fontWeight: '700' },
  scoreBadge: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  scoreValue: { fontSize: 28, fontWeight: '800', color: '#fff' },

  // Breakdown
  breakdownGrid: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  breakdownItem: { flex: 1 },
  breakdownBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: { height: '100%', borderRadius: 3 },
  breakdownValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginTop: 8,
  },
  breakdownLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Dynamics
  dynamicsSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  dynamicsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    marginBottom: 12,
  },
  dynamicsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  dynamicsItem: { flex: 1, alignItems: 'center' },
  dynamicsBar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 20,
  },
  dynamicsScore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginTop: 6,
  },
  dynamicsWeek: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  kpiFormula: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800', color: '#0F0F10', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4, textAlign: 'center' },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 12,
  },

  // Groups
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  groupMeta: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  groupHealth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthText: { fontSize: 16, fontWeight: '700' },

  // Training History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  historyDate: { fontSize: 13, fontWeight: '600', color: '#374151', width: 55 },
  historyBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  historyFill: { height: '100%', borderRadius: 4 },
  historyRate: { fontSize: 13, color: '#6B7280', width: 70, textAlign: 'right' },

  // Settings
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingsText: { flex: 1, fontSize: 16, color: '#0F0F10' },
  logoutItem: { borderBottomWidth: 0 },
  logoutText: { flex: 1, fontSize: 16, color: '#EF4444', fontWeight: '600' },
});
