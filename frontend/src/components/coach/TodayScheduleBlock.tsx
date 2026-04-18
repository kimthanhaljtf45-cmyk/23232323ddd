import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export interface TodayTraining {
  groupId: string;
  groupName: string;
  time?: string;
  studentsCount: number;
  markedToday: number;
}

interface TodayScheduleBlockProps {
  trainings: TodayTraining[];
  onTrainingPress?: (training: TodayTraining) => void;
}

export const TodayScheduleBlock: React.FC<TodayScheduleBlockProps> = ({
  trainings,
  onTrainingPress,
}) => {
  const today = new Date();
  const dayNames = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
  const dayName = dayNames[today.getDay()];
  const dateStr = today.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

  const handlePress = (training: TodayTraining) => {
    if (onTrainingPress) {
      onTrainingPress(training);
    } else {
      router.push(`/coach/attendance/${training.groupId}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Сьогодні</Text>
        <Text style={styles.date}>{dayName}, {dateStr}</Text>
      </View>

      {trainings.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={32} color="#9CA3AF" />
          <Text style={styles.emptyText}>Немає тренувань сьогодні</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {trainings.map((training) => {
            const isComplete = training.markedToday >= training.studentsCount;
            const progress = training.studentsCount > 0 
              ? Math.round((training.markedToday / training.studentsCount) * 100) 
              : 0;
            
            return (
              <TouchableOpacity
                key={training.groupId}
                style={styles.trainingCard}
                onPress={() => handlePress(training)}
                activeOpacity={0.7}
              >
                <View style={styles.trainingHeader}>
                  <View style={styles.groupInfo}>
                    <Text style={styles.groupName}>{training.groupName}</Text>
                    {training.time && (
                      <Text style={styles.groupTime}>{training.time}</Text>
                    )}
                  </View>
                  <View style={[styles.statusBadge, isComplete ? styles.statusComplete : styles.statusPending]}>
                    {isComplete ? (
                      <Ionicons name="checkmark" size={14} color="#16A34A" />
                    ) : (
                      <Text style={styles.statusText}>{progress}%</Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.studentsRow}>
                  <Ionicons name="people" size={16} color="#6B7280" />
                  <Text style={styles.studentsText}>
                    {training.markedToday} / {training.studentsCount} відмічено
                  </Text>
                </View>
                
                {!isComplete && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  date: {
    fontSize: 13,
    color: '#6B7280',
  },
  list: {
    gap: 10,
  },
  trainingCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
  },
  trainingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  groupTime: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusComplete: {
    backgroundColor: '#DCFCE7',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  studentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  studentsText: {
    fontSize: 13,
    color: '#6B7280',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E30613',
    borderRadius: 2,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
});
