import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface GoalItem {
  childId: string;
  name: string;
  target: number;
  current: number;
  percent: number;
}

export function MonthlyGoalsBlock({ items }: { items: GoalItem[] }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flag" size={20} color={colors.primary} />
        <Text style={styles.title}>Цілі на місяць</Text>
      </View>
      <View style={styles.card}>
        {items.map((item, index) => (
          <View key={item.childId} style={[styles.goalRow, index > 0 && styles.goalRowBorder]}>
            <Text style={styles.childName}>{item.name}</Text>
            <View style={styles.goalProgress}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${Math.min(item.percent, 100)}%` }
                  ]} 
                />
              </View>
              <Text style={styles.goalText}>
                {item.current}/{item.target} тренувань
              </Text>
            </View>
          </View>
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
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  goalRow: {
    paddingVertical: spacing.sm,
  },
  goalRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  childName: {
    ...typography.body,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  goalText: {
    ...typography.caption,
    color: colors.textSecondary,
    minWidth: 80,
  },
});
