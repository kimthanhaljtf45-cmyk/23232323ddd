import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes } from '@/theme';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';

type RecommendationAction = {
  type: string;
  title: string;
};

type RecommendationData = {
  programType: string;
  recommendedGroup: {
    id: string;
    name: string;
    location?: {
      name: string;
      district?: string;
    };
    coach?: {
      firstName: string;
    };
  } | null;
  actions: RecommendationAction[];
  message: string;
};

const programLabels: Record<string, string> = {
  KIDS: 'Дитяча програма',
  SPECIAL: 'Особлива програма',
  ADULT_SELF_DEFENSE: 'Самооборона',
  ADULT_PRIVATE: 'Індивідуальні',
  CONSULTATION: 'Консультація'
};

export default function RecommendationScreen() {
  const [data, setData] = useState<RecommendationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecommendation();
  }, []);

  const loadRecommendation = async () => {
    try {
      const response = await api.get('/onboarding/recommendation');
      setData(response);
    } catch (error) {
      console.error('Error loading recommendation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: RecommendationAction) => {
    if (action.type === 'BOOK_TRIAL' || action.type === 'OPEN_SCHEDULE') {
      router.replace('/(tabs)');
    } else if (action.type === 'REQUEST_CALL' || action.type === 'CONTACT') {
      // Would open contact flow
      router.replace('/(tabs)');
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Підбираємо рекомендації...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isConsultation = data?.programType === 'CONSULTATION' || data?.programType === 'SPECIAL';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Success Indicator */}
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {isConsultation ? 'Дякуємо за заявку!' : 'Вам підходить'}
          </Text>
          {data?.message && (
            <Text style={styles.message}>{data.message}</Text>
          )}
        </View>

        {/* Recommendation Card */}
        {data?.recommendedGroup && !isConsultation && (
          <View style={styles.recommendationCard}>
            <View style={styles.programBadge}>
              <Text style={styles.programBadgeText}>
                {programLabels[data.programType || 'KIDS']}
              </Text>
            </View>
            
            <Text style={styles.groupName}>{data.recommendedGroup.name}</Text>
            
            {data.recommendedGroup.location && (
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {data.recommendedGroup.location.name}
                  {data.recommendedGroup.location.district && ` (${data.recommendedGroup.location.district})`}
                </Text>
              </View>
            )}
            
            {data.recommendedGroup.coach && (
              <View style={styles.detailRow}>
                <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  Тренер: {data.recommendedGroup.coach.firstName}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Consultation Message */}
        {isConsultation && (
          <View style={styles.consultationCard}>
            <Ionicons name="call-outline" size={32} color={colors.primary} />
            <Text style={styles.consultationTitle}>
              Ми зв'яжемось з вами
            </Text>
            <Text style={styles.consultationDesc}>
              Наш адміністратор зателефонує протягом дня, щоб підібрати оптимальний формат занять.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {data?.actions.map((action, index) => (
            <Button
              key={action.type}
              title={action.title}
              onPress={() => handleAction(action)}
              variant={index === 0 ? 'primary' : 'outline'}
              size="lg"
            />
          ))}
        </View>
      </ScrollView>

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={styles.skipText}>Перейти до додатку</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing.xl,
  },
  successIcon: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 22,
  },
  recommendationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
    borderWidth: 1,
    borderColor: colors.border,
  },
  programBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  programBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: '#fff',
  },
  groupName: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  detailText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  consultationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  consultationTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  consultationDesc: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  skipBtn: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  skipText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
});
