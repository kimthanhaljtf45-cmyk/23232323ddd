import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface Training {
  id: string;
  childId?: string;
  childName: string;
  date: string;
  time: string;
  location: string;
  groupName?: string;
  coachName?: string;
}

interface Props {
  trainings: Training[];
}

export function NextTrainingBlock({ trainings }: Props) {
  if (!trainings || trainings.length === 0) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Сьогодні';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Завтра';
    }
    return date.toLocaleDateString('uk-UA', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Найближче тренування</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/schedule')}>
          <Text style={styles.seeAll}>Розклад</Text>
        </TouchableOpacity>
      </View>
      
      {trainings.slice(0, 2).map((training, index) => (
        <TouchableOpacity
          key={training.id || index}
          style={[
            styles.trainingCard,
            index === 0 && styles.trainingCardFirst,
          ]}
          onPress={() => router.push('/(tabs)/schedule')}
          activeOpacity={0.8}
        >
          <View style={styles.dateBlock}>
            <Ionicons name="calendar" size={18} color="#E30613" />
            <Text style={styles.dateText}>{formatDate(training.date)}</Text>
            <Text style={styles.timeText}>{training.time}</Text>
          </View>
          
          <View style={styles.trainingInfo}>
            <Text style={styles.childName}>{training.childName}</Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.locationText}>{training.location}</Text>
            </View>
            {training.coachName && (
              <View style={styles.coachRow}>
                <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                <Text style={styles.coachText}>{training.coachName}</Text>
              </View>
            )}
          </View>

          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
    color: '#E30613',
  },
  trainingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  trainingCardFirst: {
    backgroundColor: '#FEF7F7',
    borderColor: '#FECACA',
  },
  dateBlock: {
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    minWidth: 70,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    marginTop: 4,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E30613',
    marginTop: 2,
  },
  trainingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  childName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  coachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  coachText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
