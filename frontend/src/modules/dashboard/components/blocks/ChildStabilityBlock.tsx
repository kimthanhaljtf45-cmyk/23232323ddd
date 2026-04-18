import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface StabilityItem {
  childId: string;
  name: string;
  attendance: number;
  trend: 'up' | 'down' | 'stable';
  stabilityScore: number;
  coachCommentSummary: string;
  moodIndicator: 'happy' | 'neutral' | 'needs-support';
}

export function ChildStabilityBlock({ items }: { items: StabilityItem[] }) {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return colors.success;
      case 'down': return colors.error;
      default: return colors.textSecondary;
    }
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'happy': return 'happy';
      case 'needs-support': return 'heart';
      default: return 'ellipse';
    }
  };

  const getMoodColor = (mood: string) => {
    switch (mood) {
      case 'happy': return colors.success;
      case 'needs-support': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="heart" size={20} color={colors.primary} />
        <Text style={styles.title}>Стабільність</Text>
      </View>
      {items.map((item) => (
        <View key={item.childId} style={styles.card}>
          <View style={styles.nameRow}>
            <Ionicons name={getMoodIcon(item.moodIndicator) as any} size={24} color={getMoodColor(item.moodIndicator)} />
            <Text style={styles.childName}>{item.name}</Text>
            <View style={styles.trendBadge}>
              <Ionicons name={getTrendIcon(item.trend) as any} size={16} color={getTrendColor(item.trend)} />
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.attendance}%</Text>
              <Text style={styles.statLabel}>Відвідуваність</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{item.stabilityScore}</Text>
              <Text style={styles.statLabel}>Стабільність</Text>
            </View>
          </View>
          {item.coachCommentSummary && (
            <Text style={styles.comment} numberOfLines={2}>
              Тренер: {item.coachCommentSummary}
            </Text>
          )}
        </View>
      ))}
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
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  childName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
    flex: 1,
  },
  trendBadge: {
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.sm,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.subtitle,
    color: colors.text,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  comment: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
});
