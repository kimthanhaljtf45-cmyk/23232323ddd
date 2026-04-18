import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';
import { BELT_COLORS, BELT_LABELS } from '@/constants';

interface BeltReadyItem {
  childId: string;
  name: string;
  currentBelt: string;
  progressPercent: number;
  message: string;
}

export function BeltReadyBlock({ items }: { items: BeltReadyItem[] }) {
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="medal" size={20} color={colors.success} />
        <Text style={styles.title}>Готові до атестації!</Text>
      </View>
      {items.map((item) => (
        <View key={item.childId} style={styles.card}>
          <View style={styles.beltIcon}>
            <Ionicons name="ribbon" size={32} color={BELT_COLORS[item.currentBelt] || colors.primary} />
          </View>
          <View style={styles.content}>
            <Text style={styles.childName}>{item.name}</Text>
            <Text style={styles.message}>{item.message}</Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${item.progressPercent}%` }]} />
              </View>
              <Text style={styles.progressText}>{item.progressPercent}%</Text>
            </View>
          </View>
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
    color: colors.success,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.sm,
  },
  beltIcon: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  childName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  message: {
    ...typography.caption,
    color: colors.success,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginRight: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 3,
  },
  progressText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
