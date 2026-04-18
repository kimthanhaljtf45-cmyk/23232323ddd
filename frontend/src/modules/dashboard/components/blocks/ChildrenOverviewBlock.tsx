import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';
import { BELT_COLORS, BELT_LABELS } from '@/constants';

interface ChildOverview {
  childId: string;
  name: string;
  belt: string;
  progressPercent: number;
  attendancePercent: number;
  disciplineScore: number;
  status: 'good' | 'warning' | 'critical';
  groupName?: string;
}

export function ChildrenOverviewBlock({ items }: { items: ChildOverview[] }) {
  const router = useRouter();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return colors.error;
      case 'warning': return colors.warning;
      default: return colors.success;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'critical': return 'alert-circle';
      case 'warning': return 'warning';
      default: return 'checkmark-circle';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={20} color={colors.primary} />
        <Text style={styles.title}>Діти</Text>
      </View>
      {items.map((child) => (
        <TouchableOpacity
          key={child.childId}
          style={styles.childCard}
          onPress={() => router.push(`/child/${child.childId}` as any)}
        >
          <View style={styles.cardHeader}>
            <View style={styles.nameRow}>
              <View style={[styles.beltBadge, { backgroundColor: BELT_COLORS[child.belt] || '#ccc' }]}>
                <Text style={styles.beltText}>{BELT_LABELS[child.belt]?.[0] || child.belt[0]}</Text>
              </View>
              <Text style={styles.childName}>{child.name}</Text>
              <Ionicons 
                name={getStatusIcon(child.status) as any} 
                size={20} 
                color={getStatusColor(child.status)} 
              />
            </View>
            {child.groupName ? (
              <Text style={styles.groupName}>{child.groupName}</Text>
            ) : null}
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{child.attendancePercent}%</Text>
              <Text style={styles.statLabel}>Відвідуваність</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{child.progressPercent}%</Text>
              <Text style={styles.statLabel}>Прогрес</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{child.disciplineScore}</Text>
              <Text style={styles.statLabel}>Дисципліна</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${child.progressPercent}%`, backgroundColor: BELT_COLORS[child.belt] || colors.primary }
              ]} 
            />
          </View>
        </TouchableOpacity>
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
  childCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  cardHeader: {
    marginBottom: spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  beltBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  beltText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 12,
  },
  childName: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  groupName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
    marginLeft: 36,
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
  progressBar: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
});
