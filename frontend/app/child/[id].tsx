import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator,
  RefreshControl 
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

// Types
interface CoachInfo {
  id: string;
  firstName: string;
  lastName?: string;
  phone?: string;
}

interface GroupInfo {
  id: string;
  name: string;
  programType: string;
  schedule?: { day: string; time: string }[];
}

interface ChildDetail {
  id: string;
  firstName: string;
  lastName?: string;
  belt: string;
  programType: string;
  monthlyGoalTarget: number;
  coachApprovedForNextBelt: boolean;
  coachCommentSummary?: string;
  coach?: CoachInfo;
  group?: GroupInfo;
  attendance?: {
    percent: number;
    streak: number;
    monthlyCount: number;
    monthlyTarget: number;
    recentDays: { date: string; status: 'PRESENT' | 'ABSENT' | 'WARNED' | 'LATE' | null }[];
  };
  retention?: {
    status: 'good' | 'stable' | 'warning' | 'critical';
    streak: number;
    engagementScore: number;
  };
  achievements?: { id: string; title: string; type: string; date: string }[];
}

const BELT_COLORS: Record<string, string> = {
  'WHITE': '#FFFFFF',
  'YELLOW': '#FEF08A',
  'ORANGE': '#FDBA74',
  'GREEN': '#86EFAC',
  'BLUE': '#93C5FD',
  'BROWN': '#A8A29E',
  'BLACK': '#1F2937',
};

const BELT_NAMES: Record<string, string> = {
  'WHITE': 'Білий',
  'YELLOW': 'Жовтий',
  'ORANGE': 'Помаранчевий',
  'GREEN': 'Зелений',
  'BLUE': 'Синій',
  'BROWN': 'Коричневий',
  'BLACK': 'Чорний',
};

const STATUS_ICON: Record<string, { color: string; bg: string }> = {
  'PRESENT': { color: '#22C55E', bg: '#DCFCE7' },
  'ABSENT': { color: '#EF4444', bg: '#FEE2E2' },
  'WARNED': { color: '#F59E0B', bg: '#FEF3C7' },
  'LATE': { color: '#F97316', bg: '#FFEDD5' },
};

export default function ChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [child, setChild] = useState<ChildDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChildDetails = async () => {
    try {
      // Get child data with coach info
      const childData = await api.getChild(id);
      
      // Get retention data
      let retentionData = null;
      try {
        retentionData = await api.getChildRetention(id);
      } catch (e) {
        console.log('Retention data not available');
      }

      // Get attendance data
      let attendanceData = null;
      try {
        attendanceData = await api.getChildAttendance(id);
      } catch (e) {
        console.log('Attendance data not available');
      }

      // Build recent days attendance grid
      const recentDays: ChildDetail['attendance']['recentDays'] = [];
      const today = new Date();
      for (let i = 11; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        const attendance = attendanceData?.find((a: any) => a.date === dateStr);
        recentDays.push({
          date: dateStr,
          status: attendance?.status || null,
        });
      }

      setChild({
        id: childData.id || childData._id,
        firstName: childData.firstName,
        lastName: childData.lastName,
        belt: childData.belt || 'WHITE',
        programType: childData.programType,
        monthlyGoalTarget: childData.monthlyGoalTarget || 12,
        coachApprovedForNextBelt: childData.coachApprovedForNextBelt || false,
        coachCommentSummary: childData.coachCommentSummary,
        coach: childData.coach || null,
        group: childData.group || null,
        attendance: {
          percent: retentionData?.attendanceRate || 0,
          streak: retentionData?.streak || 0,
          monthlyCount: retentionData?.monthlyGoal?.current || 0,
          monthlyTarget: retentionData?.monthlyGoal?.target || 12,
          recentDays,
        },
        retention: {
          status: retentionData?.engagementStatus || 'stable',
          streak: retentionData?.streak || 0,
          engagementScore: 0,
        },
        achievements: retentionData?.recentAchievements || [],
      });
    } catch (error) {
      console.error('Failed to load child details:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadChildDetails();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChildDetails();
  };

  const handleMessageCoach = () => {
    if (child?.coach?.id) {
      router.push(`/messages?coachId=${child.coach.id}`);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      </SafeAreaView>
    );
  }

  if (!child) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Не вдалося завантажити дані</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadChildDetails}>
            <Text style={styles.retryButtonText}>Повторити</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${child.firstName} ${child.lastName || ''}`.trim();
  const beltColor = BELT_COLORS[child.belt] || '#FFFFFF';
  const beltName = BELT_NAMES[child.belt] || child.belt;
  const monthlyPercent = child.attendance 
    ? Math.round((child.attendance.monthlyCount / child.attendance.monthlyTarget) * 100) 
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Профіль учня</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatar, { backgroundColor: beltColor, borderWidth: child.belt === 'WHITE' ? 2 : 0, borderColor: '#E5E7EB' }]}>
              <Text style={[styles.avatarText, { color: child.belt === 'BLACK' ? '#FFF' : '#000' }]}>
                {child.firstName.charAt(0)}
              </Text>
            </View>
            {child.coachApprovedForNextBelt && (
              <View style={styles.beltReadyBadge}>
                <Ionicons name="star" size={12} color="#FFF" />
              </View>
            )}
          </View>
          <Text style={styles.profileName}>{fullName}</Text>
          <View style={styles.beltBadge}>
            <View style={[styles.beltDot, { backgroundColor: beltColor, borderWidth: child.belt === 'WHITE' ? 1 : 0, borderColor: '#D1D5DB' }]} />
            <Text style={styles.beltText}>{beltName} пояс</Text>
          </View>
        </View>

        {/* Coach Card - KEY FEATURE: Student → Coach binding */}
        {child.coach && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Тренер</Text>
            <View style={styles.coachCard}>
              <View style={styles.coachAvatar}>
                <Ionicons name="person" size={24} color="#6B7280" />
              </View>
              <View style={styles.coachInfo}>
                <Text style={styles.coachName}>
                  {child.coach.firstName} {child.coach.lastName || ''}
                </Text>
                {child.group && (
                  <Text style={styles.coachGroup}>Група: {child.group.name}</Text>
                )}
              </View>
              <TouchableOpacity 
                style={styles.messageCoachButton} 
                onPress={handleMessageCoach}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble" size={18} color="#FFF" />
                <Text style={styles.messageCoachText}>Написати</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Group Info */}
        {child.group && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Група</Text>
            <View style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{child.group.name}</Text>
                <View style={styles.programBadge}>
                  <Text style={styles.programText}>
                    {child.group.programType === 'KIDS' ? 'Дитяча' : 
                     child.group.programType === 'SPECIAL' ? 'Особлива' :
                     child.group.programType === 'SELF_DEFENSE' ? 'Самооборона' : 
                     child.group.programType}
                  </Text>
                </View>
              </View>
              {child.group.schedule && child.group.schedule.length > 0 && (
                <View style={styles.scheduleList}>
                  {child.group.schedule.map((s, i) => (
                    <View key={i} style={styles.scheduleItem}>
                      <Text style={styles.scheduleDay}>{s.day}</Text>
                      <Text style={styles.scheduleTime}>{s.time}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Attendance Grid - KEY FEATURE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Відвідуваність</Text>
            {child.attendance && (
              <Text style={styles.attendancePercent}>{child.attendance.percent}%</Text>
            )}
          </View>
          
          {/* Attendance Grid */}
          <View style={styles.attendanceGrid}>
            {child.attendance?.recentDays.map((day, index) => {
              const statusStyle = day.status ? STATUS_ICON[day.status] : null;
              return (
                <View 
                  key={index} 
                  style={[
                    styles.attendanceDay,
                    statusStyle ? { backgroundColor: statusStyle.bg } : { backgroundColor: '#F3F4F6' }
                  ]}
                >
                  {day.status === 'PRESENT' && (
                    <Ionicons name="checkmark" size={14} color={statusStyle?.color} />
                  )}
                  {day.status === 'ABSENT' && (
                    <Ionicons name="close" size={14} color={statusStyle?.color} />
                  )}
                  {day.status === 'WARNED' && (
                    <Ionicons name="alert" size={14} color={statusStyle?.color} />
                  )}
                  {day.status === 'LATE' && (
                    <Ionicons name="time" size={14} color={statusStyle?.color} />
                  )}
                  {!day.status && (
                    <View style={styles.emptyDay} />
                  )}
                </View>
              );
            })}
          </View>
          
          {/* Legend */}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText}>Був</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendText}>Пропустив</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={styles.legendText}>Попередив</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#D1D5DB' }]} />
              <Text style={styles.legendText}>Ще не було</Text>
            </View>
          </View>
        </View>

        {/* Monthly Goal - KEY FEATURE */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Місячна ціль</Text>
          <View style={styles.goalCard}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalCount}>
                {child.attendance?.monthlyCount || 0} / {child.attendance?.monthlyTarget || 12}
              </Text>
              <Text style={styles.goalLabel}>тренувань</Text>
            </View>
            <View style={styles.goalProgressBar}>
              <View 
                style={[
                  styles.goalProgressFill, 
                  { 
                    width: `${Math.min(monthlyPercent, 100)}%`,
                    backgroundColor: monthlyPercent >= 80 ? '#22C55E' : monthlyPercent >= 50 ? '#F59E0B' : '#EF4444'
                  }
                ]} 
              />
            </View>
            {child.attendance && child.attendance.streak > 0 && (
              <View style={styles.streakRow}>
                <Ionicons name="flame" size={16} color="#F59E0B" />
                <Text style={styles.streakText}>
                  {child.attendance.streak} тренувань підряд
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Belt Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Прогрес поясу</Text>
          <View style={styles.beltProgressCard}>
            <View style={styles.beltProgressHeader}>
              <View style={[styles.currentBelt, { backgroundColor: beltColor, borderWidth: child.belt === 'WHITE' ? 1 : 0, borderColor: '#D1D5DB' }]} />
              <Ionicons name="arrow-forward" size={20} color="#9CA3AF" />
              <View style={[styles.nextBelt, { backgroundColor: getNextBeltColor(child.belt) }]} />
            </View>
            {child.coachApprovedForNextBelt ? (
              <View style={styles.beltReadyAlert}>
                <Ionicons name="star" size={20} color="#F59E0B" />
                <Text style={styles.beltReadyText}>
                  Тренер схвалив перехід на наступний пояс!
                </Text>
              </View>
            ) : (
              <Text style={styles.beltProgressHint}>
                Продовжуйте тренуватися для переходу
              </Text>
            )}
          </View>
        </View>

        {/* Coach Comment */}
        {child.coachCommentSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Коментар тренера</Text>
            <View style={styles.commentCard}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#6B7280" />
              <Text style={styles.commentText}>{child.coachCommentSummary}</Text>
            </View>
          </View>
        )}

        {/* Achievements */}
        {child.achievements && child.achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Досягнення</Text>
            <View style={styles.achievementsList}>
              {child.achievements.map((achievement) => (
                <View key={achievement.id} style={styles.achievementCard}>
                  <View style={styles.achievementIcon}>
                    <Ionicons 
                      name={
                        achievement.type === 'streak' ? 'flame' : 
                        achievement.type === 'belt' ? 'ribbon' : 
                        'trophy'
                      } 
                      size={20} 
                      color="#F59E0B" 
                    />
                  </View>
                  <Text style={styles.achievementTitle}>{achievement.title}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function to get next belt color
function getNextBeltColor(currentBelt: string): string {
  const beltOrder = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'];
  const currentIndex = beltOrder.indexOf(currentBelt);
  if (currentIndex >= 0 && currentIndex < beltOrder.length - 1) {
    return BELT_COLORS[beltOrder[currentIndex + 1]];
  }
  return BELT_COLORS['BLACK'];
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#E30613',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
  },
  beltReadyBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F0F10',
    marginTop: 12,
  },
  beltBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  beltDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  beltText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 12,
  },
  attendancePercent: {
    fontSize: 17,
    fontWeight: '800',
    color: '#22C55E',
  },
  // Coach Card
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    gap: 12,
  },
  coachAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachInfo: {
    flex: 1,
  },
  coachName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  coachGroup: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  messageCoachButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E30613',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  messageCoachText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  // Group Card
  groupCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  programBadge: {
    backgroundColor: '#EBF5FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  programText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  scheduleList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  scheduleDay: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  scheduleTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  // Attendance Grid
  attendanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  attendanceDay: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDay: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#6B7280',
  },
  // Goal Card
  goalCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  goalCount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F10',
  },
  goalLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  goalProgressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  goalProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  streakText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
  },
  // Belt Progress
  beltProgressCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  beltProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  currentBelt: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  nextBelt: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  beltReadyAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
  },
  beltReadyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
  },
  beltProgressHint: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
    marginTop: 12,
  },
  // Comment Card
  commentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
  },
  commentText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
  },
  // Achievements
  achievementsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  achievementIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  achievementTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F0F10',
  },
});
