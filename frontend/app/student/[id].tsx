import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes } from '@/theme';
import { api } from '@/lib/api';
import { ProgressBar } from '@/components/ui';

type StudentProfile = {
  id: string;
  programType: string;
  name: string;
  firstName: string;
  lastName?: string;
  belt: string;
  discipline: number;
  coachComment?: string;
  
  // KIDS specific
  goal?: { current: number; target: number };
  rating?: { rank: number; score: number; movement?: number };
  progress?: {
    currentBelt: string;
    nextBelt: string;
    percent: number;
    trainingsToNext: number;
    trainingsCompleted: number;
  };
  achievements?: Array<{ id: string; title: string; type: string }>;
  
  // SPECIAL specific
  stability?: string;
  concentration?: string;
  socialProgress?: string;
  adaptiveGoals?: string[];
  softProgress?: { attendance: number; engagement: number; socialSkills: number };
  
  // ADULT specific
  attendance?: { current: number; target: number };
  skills?: Array<{ name: string; level: number }>;
  fitness?: { stamina: number; strength: number; flexibility: number };
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
  WHITE: 'Білий пояс',
  YELLOW: 'Жовтий пояс',
  ORANGE: 'Помаранчевий пояс',
  GREEN: 'Зелений пояс',
  BLUE: 'Синій пояс',
  BROWN: 'Коричневий пояс',
  BLACK: 'Чорний пояс'
};

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      const data = await api.get(`/student/profile/${id}`);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Профіль не знайдено</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Повернутись</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render based on program type
  if (profile.programType === 'SPECIAL') {
    return <SpecialProfile profile={profile} />;
  }

  if (profile.programType === 'ADULT_SELF_DEFENSE' || profile.programType === 'ADULT_PRIVATE') {
    return <AdultProfile profile={profile} />;
  }

  // Default: KIDS profile
  return <KidsProfile profile={profile} />;
}

// KIDS Profile Component
function KidsProfile({ profile }: { profile: StudentProfile }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={styles.name}>{profile.name}</Text>
          <View style={[styles.beltBadge, { backgroundColor: beltColors[profile.belt] || '#F5F5F5' }]}>
            <Text style={[
              styles.beltText,
              profile.belt === 'WHITE' && { color: colors.text }
            ]}>
              {beltLabels[profile.belt] || profile.belt}
            </Text>
          </View>
        </View>

        {/* Discipline */}
        <View style={styles.section}>
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Дисципліна</Text>
              <Text style={[
                styles.statValue,
                { color: profile.discipline >= 80 ? colors.success : profile.discipline >= 60 ? colors.warning : colors.error }
              ]}>
                {profile.discipline}%
              </Text>
            </View>
            <ProgressBar value={profile.discipline} color={colors.primary} />
          </View>
        </View>

        {/* Goal */}
        {profile.goal && (
          <View style={styles.section}>
            <View style={styles.statCard}>
              <Text style={styles.cardTitle}>Ціль місяця</Text>
              <View style={styles.goalStats}>
                <Text style={styles.goalValue}>
                  {profile.goal.current} / {profile.goal.target}
                </Text>
                <Text style={styles.goalUnit}>тренувань</Text>
              </View>
              <ProgressBar 
                value={(profile.goal.current / profile.goal.target) * 100} 
                color={colors.primary} 
              />
            </View>
          </View>
        )}

        {/* Rating */}
        {profile.rating && (
          <TouchableOpacity 
            style={styles.section}
            onPress={() => router.push('/rating')}
            activeOpacity={0.8}
          >
            <View style={styles.ratingCard}>
              <View style={styles.ratingHeader}>
                <Text style={styles.cardTitle}>Рейтинг</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </View>
              <View style={styles.ratingStats}>
                <View style={styles.ratingItem}>
                  <Text style={styles.ratingRank}>#{profile.rating.rank}</Text>
                  <Text style={styles.ratingLabel}>у групі</Text>
                </View>
                <View style={styles.ratingItem}>
                  <Text style={styles.ratingScore}>{Math.round(profile.rating.score)}</Text>
                  <Text style={styles.ratingLabel}>балів</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Progress to next belt */}
        {profile.progress && (
          <View style={styles.section}>
            <View style={styles.statCard}>
              <Text style={styles.cardTitle}>Прогрес до поясу</Text>
              <View style={styles.progressHeader}>
                <View style={[styles.beltSmall, { backgroundColor: beltColors[profile.progress.currentBelt] }]} />
                <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
                <View style={[styles.beltSmall, { backgroundColor: beltColors[profile.progress.nextBelt] }]} />
              </View>
              <ProgressBar value={profile.progress.percent} color={colors.primary} />
              <Text style={styles.progressText}>
                {profile.progress.trainingsCompleted} / {profile.progress.trainingsToNext} тренувань
              </Text>
            </View>
          </View>
        )}

        {/* Coach Comment */}
        {profile.coachComment && (
          <View style={styles.section}>
            <View style={styles.commentCard}>
              <Text style={styles.cardTitle}>Коментар тренера</Text>
              <Text style={styles.commentText}>{profile.coachComment}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// SPECIAL Profile Component
function SpecialProfile({ profile }: { profile: StudentProfile }) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'good': return colors.success;
      case 'improving': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'good': return 'Добре';
      case 'improving': return 'Покращується';
      default: return 'Розвивається';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={styles.name}>{profile.name}</Text>
          <View style={styles.programBadge}>
            <Text style={styles.programBadgeText}>Особлива програма</Text>
          </View>
        </View>

        {/* Status Section - NO RATINGS for Special */}
        <View style={styles.section}>
          <View style={styles.statCard}>
            <Text style={styles.cardTitle}>Стан розвитку</Text>
            
            <View style={styles.specialRow}>
              <Text style={styles.specialLabel}>Стабільність</Text>
              <Text style={[styles.specialValue, { color: getStatusColor(profile.stability) }]}>
                {getStatusLabel(profile.stability)}
              </Text>
            </View>
            
            <View style={styles.specialRow}>
              <Text style={styles.specialLabel}>Концентрація</Text>
              <Text style={[styles.specialValue, { color: getStatusColor(profile.concentration) }]}>
                {getStatusLabel(profile.concentration)}
              </Text>
            </View>
            
            <View style={styles.specialRow}>
              <Text style={styles.specialLabel}>Соціалізація</Text>
              <Text style={[styles.specialValue, { color: getStatusColor(profile.socialProgress) }]}>
                {profile.socialProgress === 'positive' ? 'Позитивна' : 'Розвивається'}
              </Text>
            </View>
          </View>
        </View>

        {/* Soft Progress */}
        {profile.softProgress && (
          <View style={styles.section}>
            <View style={styles.statCard}>
              <Text style={styles.cardTitle}>М'який прогрес</Text>
              
              <View style={styles.softProgressItem}>
                <Text style={styles.softLabel}>Відвідування</Text>
                <ProgressBar value={profile.softProgress.attendance} color={colors.success} />
              </View>
              
              <View style={styles.softProgressItem}>
                <Text style={styles.softLabel}>Залученість</Text>
                <ProgressBar value={profile.softProgress.engagement} color={colors.primary} />
              </View>
              
              <View style={styles.softProgressItem}>
                <Text style={styles.softLabel}>Соціальні навички</Text>
                <ProgressBar value={profile.softProgress.socialSkills} color={colors.warning} />
              </View>
            </View>
          </View>
        )}

        {/* Coach Comment */}
        {profile.coachComment && (
          <View style={styles.section}>
            <View style={styles.commentCard}>
              <Text style={styles.cardTitle}>Коментар тренера</Text>
              <Text style={styles.commentText}>{profile.coachComment}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ADULT Profile Component
function AdultProfile({ profile }: { profile: StudentProfile }) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          
          <Text style={styles.name}>{profile.name}</Text>
          <View style={[styles.programBadge, { backgroundColor: '#EF4444' }]}>
            <Text style={styles.programBadgeText}>
              {profile.programType === 'ADULT_PRIVATE' ? 'Індивідуальні' : 'Самооборона'}
            </Text>
          </View>
        </View>

        {/* Attendance Goal */}
        {profile.attendance && (
          <View style={styles.section}>
            <View style={styles.statCard}>
              <Text style={styles.cardTitle}>Відвідування</Text>
              <View style={styles.goalStats}>
                <Text style={styles.goalValue}>
                  {profile.attendance.current} / {profile.attendance.target}
                </Text>
                <Text style={styles.goalUnit}>тренувань</Text>
              </View>
              <ProgressBar 
                value={(profile.attendance.current / profile.attendance.target) * 100} 
                color={colors.primary} 
              />
            </View>
          </View>
        )}

        {/* Skills */}
        {profile.skills && profile.skills.length > 0 && (
          <View style={styles.section}>
            <View style={styles.statCard}>
              <Text style={styles.cardTitle}>Навички</Text>
              {profile.skills.map((skill, index) => (
                <View key={index} style={styles.skillItem}>
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <ProgressBar value={skill.level} color={colors.primary} />
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Fitness */}
        {profile.fitness && (
          <View style={styles.section}>
            <View style={styles.statCard}>
              <Text style={styles.cardTitle}>Фізична форма</Text>
              
              <View style={styles.skillItem}>
                <Text style={styles.skillName}>Витривалість</Text>
                <ProgressBar value={profile.fitness.stamina} color={colors.success} />
              </View>
              
              <View style={styles.skillItem}>
                <Text style={styles.skillName}>Сила</Text>
                <ProgressBar value={profile.fitness.strength} color={colors.primary} />
              </View>
              
              <View style={styles.skillItem}>
                <Text style={styles.skillName}>Гнучкість</Text>
                <ProgressBar value={profile.fitness.flexibility} color={colors.warning} />
              </View>
            </View>
          </View>
        )}
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: fontSizes.lg,
    color: colors.textSecondary,
  },
  backLink: {
    fontSize: fontSizes.base,
    color: colors.primary,
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
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    marginTop: spacing.xl,
  },
  beltBadge: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginTop: spacing.md,
  },
  beltText: {
    fontSize: fontSizes.base,
    fontWeight: '700',
    color: '#fff',
  },
  programBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    marginTop: spacing.md,
  },
  programBadgeText: {
    fontSize: fontSizes.base,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSizes.base,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statLabel: {
    fontSize: fontSizes.base,
    color: colors.text,
  },
  statValue: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
  },
  goalStats: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.sm,
  },
  goalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  goalUnit: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  ratingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.md,
  },
  ratingItem: {
    alignItems: 'center',
  },
  ratingRank: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  ratingScore: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.primary,
  },
  ratingLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  beltSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  progressText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  commentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
  },
  commentText: {
    fontSize: fontSizes.base,
    color: colors.text,
    lineHeight: 22,
  },
  specialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  specialLabel: {
    fontSize: fontSizes.base,
    color: colors.text,
  },
  specialValue: {
    fontSize: fontSizes.base,
    fontWeight: '600',
  },
  softProgressItem: {
    marginBottom: spacing.md,
  },
  softLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  skillItem: {
    marginBottom: spacing.md,
  },
  skillName: {
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
  },
});
