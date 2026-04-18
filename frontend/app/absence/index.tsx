import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../src/theme';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';
import { Button } from '../../src/components/ui';

const REASONS = [
  { key: 'illness', label: 'Хвороба', icon: '🤒' },
  { key: 'family', label: 'Сімейні обставини', icon: '👨‍👩‍👧' },
  { key: 'vacation', label: 'Відпустка', icon: '✈️' },
  { key: 'other', label: 'Інше', icon: '📝' },
];

export default function ReportAbsence() {
  const { childId, childName } = useLocalSearchParams<{ childId: string; childName: string }>();
  const [upcomingTrainings, setUpcomingTrainings] = useState<any[]>([]);
  const [selectedTraining, setSelectedTraining] = useState<any>(null);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (childId) loadUpcomingTrainings();
  }, [childId]);

  const loadUpcomingTrainings = async () => {
    try {
      setLoading(true);
      const data = await api.getUpcomingTrainings(childId!);
      setUpcomingTrainings(data);
      // Pre-select first non-reported training
      const firstAvailable = data.find((t: any) => !t.alreadyReported);
      if (firstAvailable) setSelectedTraining(firstAvailable);
    } catch (error) {
      console.error('Error loading trainings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTraining || !selectedReason) {
      Alert.alert('Помилка', 'Оберіть тренування та причину');
      return;
    }

    try {
      setSubmitting(true);
      await api.reportAbsence({
        childId: childId!,
        scheduleId: selectedTraining.id,
        date: selectedTraining.date,
        reason: selectedReason,
        comment: comment.trim() || undefined,
      });

      Alert.alert(
        'Готово! ✅',
        'Тренера повідомлено про пропуск',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося надіслати повідомлення');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTrainingDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, 'EEEE, d MMMM', { locale: uk });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Повідомити про пропуск</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Child Info */}
        <View style={styles.childInfo}>
          <Text style={styles.childLabel}>Дитина:</Text>
          <Text style={styles.childName}>{childName || 'Дитина'}</Text>
        </View>

        {/* Select Training */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Оберіть тренування</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : upcomingTrainings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Немає запланованих тренувань</Text>
            </View>
          ) : (
            upcomingTrainings.map((training) => (
              <TouchableOpacity
                key={training.id}
                style={[
                  styles.trainingCard,
                  selectedTraining?.id === training.id && styles.trainingCardSelected,
                  training.alreadyReported && styles.trainingCardDisabled,
                ]}
                onPress={() => !training.alreadyReported && setSelectedTraining(training)}
                disabled={training.alreadyReported}
              >
                <View style={styles.trainingDate}>
                  <Text style={[
                    styles.trainingDateText,
                    selectedTraining?.id === training.id && styles.trainingDateTextSelected
                  ]}>
                    {formatTrainingDate(training.date)}
                  </Text>
                  <Text style={styles.trainingTime}>
                    {training.startTime} - {training.endTime}
                  </Text>
                </View>
                
                {training.alreadyReported ? (
                  <View style={styles.reportedBadge}>
                    <Text style={styles.reportedText}>✓ Повідомлено</Text>
                  </View>
                ) : selectedTraining?.id === training.id ? (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                ) : (
                  <Ionicons name="ellipse-outline" size={24} color={colors.textTertiary} />
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Select Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Причина</Text>
          
          <View style={styles.reasonsGrid}>
            {REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.key}
                style={[
                  styles.reasonCard,
                  selectedReason === reason.key && styles.reasonCardSelected,
                ]}
                onPress={() => setSelectedReason(reason.key)}
              >
                <Text style={styles.reasonIcon}>{reason.icon}</Text>
                <Text style={[
                  styles.reasonLabel,
                  selectedReason === reason.key && styles.reasonLabelSelected
                ]}>
                  {reason.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Comment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Коментар (необов'язково)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="Додаткова інформація для тренера..."
            placeholderTextColor={colors.textTertiary}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={200}
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <Button
          title="Повідомити тренера"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!selectedTraining || !selectedReason || submitting}
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  childInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    backgroundColor: colors.backgroundSecondary,
    gap: spacing.sm,
  },
  childLabel: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  childName: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  section: {
    padding: spacing.base,
  },
  sectionTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  trainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.base,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  trainingCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  trainingCardDisabled: {
    opacity: 0.6,
  },
  trainingDate: {
    flex: 1,
  },
  trainingDateText: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
    textTransform: 'capitalize',
  },
  trainingDateTextSelected: {
    color: colors.primary,
  },
  trainingTime: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  reportedBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  reportedText: {
    fontSize: fontSizes.xs,
    color: colors.success,
    fontWeight: fontWeights.medium,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  reasonCard: {
    width: '48%',
    padding: spacing.base,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  reasonIcon: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  reasonLabel: {
    fontSize: fontSizes.sm,
    color: colors.text,
    textAlign: 'center',
  },
  reasonLabelSelected: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  commentInput: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    fontSize: fontSizes.base,
    color: colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: {
    padding: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
