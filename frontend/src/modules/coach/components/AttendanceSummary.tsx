import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  total: number;
  marked: number;
  pending: number;
}

export function AttendanceSummary({ total, marked, pending }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Attendance</Text>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Усього</Text>
          <Text style={styles.statValue}>{total}</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Відмічено</Text>
          <Text style={[styles.statValue, { color: '#22C55E' }]}>{marked}</Text>
        </View>

        <View style={styles.stat}>
          <Text style={styles.statLabel}>Залишилось</Text>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{pending}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F0F10',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
});
