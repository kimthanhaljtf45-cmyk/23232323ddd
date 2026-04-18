import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface Props {
  current: number;
  target: number;
  streak?: number;
  recommendation?: string;
}

export function RetentionBlock({ current, target, streak = 0, recommendation }: Props) {
  const percent = Math.round((current / Math.max(target, 1)) * 100);
  const progressColor = percent >= 80 ? colors.success : percent >= 50 ? colors.warning : colors.error;
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ціль місяця</Text>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>{streak}</Text>
            <Ionicons name="flame" size={14} color="#F97316" />
          </View>
        )}
      </View>
      
      <View style={styles.statsRow}>
        <Text style={styles.value}>{current}</Text>
        <Text style={styles.separator}>/</Text>
        <Text style={styles.target}>{target}</Text>
        <Text style={styles.unit}>тренувань</Text>
      </View>
      
      <View style={styles.progressBar}>
        <View 
          style={[
            styles.progressFill, 
            { width: `${Math.min(percent, 100)}%`, backgroundColor: progressColor }
          ]} 
        />
      </View>
      
      {recommendation && (
        <View style={styles.recommendationBox}>
          <Text style={styles.recommendationText}>{recommendation}</Text>
        </View>
      )}

      {streak >= 3 && (
        <View style={styles.achievementBox}>
          <Ionicons name="trophy" size={16} color="#F59E0B" />
          <Text style={styles.achievementText}>Серія {streak} тренувань поспіль!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D97706',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  value: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000',
  },
  separator: {
    fontSize: 24,
    fontWeight: '400',
    color: colors.textTertiary,
    marginHorizontal: 4,
  },
  target: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  unit: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  recommendationBox: {
    marginTop: 12,
    backgroundColor: '#000',
    padding: 12,
    borderRadius: 12,
  },
  recommendationText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  achievementBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  achievementText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
});
