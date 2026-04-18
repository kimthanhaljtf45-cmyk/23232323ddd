import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

const DAY_NAMES = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

interface Training {
  scheduleId: string;
  childId?: string;
  childName?: string;
  date: string;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
}

export function NextTrainingsBlock({ items }: { items: Training[] }) {
  const router = useRouter();

  const formatDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'd MMMM', { locale: uk });
    } catch {
      return dateStr;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="calendar" size={20} color={colors.primary} />
        <Text style={styles.title}>Наступні тренування</Text>
      </View>
      <View style={styles.list}>
        {items.slice(0, 3).map((training, index) => (
          <TouchableOpacity
            key={`${training.scheduleId}-${index}`}
            style={styles.trainingCard}
            onPress={() => router.push('/(tabs)/schedule' as any)}
          >
            <View style={styles.dateBox}>
              <Text style={styles.dayName}>{DAY_NAMES[training.dayOfWeek % 7]}</Text>
              <Text style={styles.dateText}>{formatDate(training.date)}</Text>
            </View>
            <View style={styles.trainingInfo}>
              {training.childName && (
                <Text style={styles.childName}>{training.childName}</Text>
              )}
              <Text style={styles.timeText}>
                {training.startTime} - {training.endTime}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  list: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  trainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateBox: {
    alignItems: 'center',
    marginRight: spacing.md,
    minWidth: 60,
  },
  dayName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  dateText: {
    ...typography.bodySmall,
    color: colors.text,
  },
  trainingInfo: {
    flex: 1,
  },
  childName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text,
  },
  timeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
