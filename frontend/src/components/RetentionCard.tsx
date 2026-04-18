import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RetentionCardProps {
  streak: number;
  monthlyGoal: {
    target: number;
    current: number;
    percent: number;
  };
  engagementStatus: 'good' | 'warning' | 'critical' | 'stable';
  nextMilestone?: {
    type: string;
    title: string;
    progress?: number;
  };
  recommendations?: Array<{ type: string; title: string }>;
}

const statusConfig = {
  good: { color: '#22C55E', icon: 'trending-up' as const, label: 'Відмінно' },
  stable: { color: '#3B82F6', icon: 'analytics' as const, label: 'Стабільно' },
  warning: { color: '#F59E0B', icon: 'alert' as const, label: 'Потребує уваги' },
  critical: { color: '#EF4444', icon: 'trending-down' as const, label: 'Критично' },
};

export function RetentionCard({
  streak,
  monthlyGoal,
  engagementStatus,
  nextMilestone,
  recommendations,
}: RetentionCardProps) {
  const status = statusConfig[engagementStatus];

  return (
    <View style={styles.container}>
      {/* Streak Block */}
      <View style={styles.streakBlock}>
        <View style={styles.streakIcon}>
          <Ionicons name="flame" size={24} color="#F59E0B" />
        </View>
        <View style={styles.streakInfo}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>тренувань поспіль</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
          <Ionicons name={status.icon} size={14} color={status.color} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      {/* Monthly Goal */}
      <View style={styles.goalBlock}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>Місячна ціль</Text>
          <Text style={styles.goalProgress}>
            {monthlyGoal.current}/{monthlyGoal.target}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(monthlyGoal.percent, 100)}%`,
                backgroundColor: monthlyGoal.percent >= 100 ? '#22C55E' : '#3B82F6',
              },
            ]}
          />
        </View>
        <Text style={styles.goalPercent}>{monthlyGoal.percent}% виконано</Text>
      </View>

      {/* Next Milestone */}
      {nextMilestone && (
        <View style={styles.milestoneBlock}>
          <Ionicons name="ribbon" size={18} color="#8B5CF6" />
          <Text style={styles.milestoneText}>{nextMilestone.title}</Text>
        </View>
      )}

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <View style={styles.recommendationsBlock}>
          <Text style={styles.recommendationsTitle}>Рекомендації</Text>
          {recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationItem}>
              <Ionicons name="bulb-outline" size={16} color="#F59E0B" />
              <Text style={styles.recommendationText}>{rec.title}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  streakBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  streakInfo: {
    flex: 1,
  },
  streakNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F0F10',
  },
  streakLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  goalBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  goalProgress: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F0F10',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  goalPercent: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },
  milestoneBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  milestoneText: {
    flex: 1,
    fontSize: 13,
    color: '#5B21B6',
    fontWeight: '500',
  },
  recommendationsBlock: {
    marginTop: 4,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
});
