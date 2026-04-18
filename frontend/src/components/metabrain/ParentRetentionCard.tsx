import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import SegmentBadge from './SegmentBadge';

type Segment = 'VIP' | 'ACTIVE' | 'WARNING' | 'CHURN_RISK';

interface Props {
  childName: string;
  riskScore: number;
  segment: Segment;
  attendanceRate: number;
  missedInRow: number;
}

export default function ParentRetentionCard({
  childName,
  riskScore,
  segment,
  attendanceRate,
  missedInRow,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{childName}</Text>

      <View style={styles.badgeContainer}>
        <SegmentBadge segment={segment} />
      </View>

      <Text style={styles.stat}>
        Risk Score: {riskScore}/100
      </Text>

      <Text style={styles.statSecondary}>
        Відвідування: {attendanceRate}%
      </Text>

      <Text style={styles.statSecondary}>
        Пропущено підряд: {missedInRow}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  name: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
  },
  badgeContainer: {
    marginTop: 10,
  },
  stat: {
    marginTop: 14,
    color: '#444',
  },
  statSecondary: {
    marginTop: 6,
    color: '#666',
  },
});
