import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

interface Props {
  revenueAtRisk: number;
  activeRevenue: number;
  savedUsers: number;
}

export default function AdminRevenueRiskCard({
  revenueAtRisk,
  activeRevenue,
  savedUsers,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>Фінансовий ризик</Text>

      <Text style={styles.stat}>
        Дохід під ризиком: {revenueAtRisk.toLocaleString()} грн
      </Text>

      <Text style={styles.stat}>
        Активний дохід: {activeRevenue.toLocaleString()} грн
      </Text>

      <Text style={styles.savedText}>
        Врятовано клієнтів: {savedUsers}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
  },
  header: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '800',
  },
  stat: {
    color: '#DDD',
    marginTop: 14,
  },
  savedText: {
    color: '#8BC34A',
    marginTop: 8,
    fontWeight: '700',
  },
});
