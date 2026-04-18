import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

interface Props {
  totalStudents: number;
  riskCount: number;
  warningCount: number;
  vipCount: number;
}

export default function AdminRiskOverview({
  totalStudents,
  riskCount,
  warningCount,
  vipCount,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.header}>Огляд ризиків</Text>

      <Text style={styles.stat}>Усього учнів: {totalStudents}</Text>
      <Text style={[styles.stat, styles.riskText]}>
        Ризик відтоку: {riskCount}
      </Text>
      <Text style={[styles.stat, styles.warningText]}>
        Увага: {warningCount}
      </Text>
      <Text style={[styles.stat, styles.vipText]}>
        VIP / лояльні: {vipCount}
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
  header: {
    fontSize: 18,
    fontWeight: '800',
  },
  stat: {
    marginTop: 14,
  },
  riskText: {
    color: '#C62828',
  },
  warningText: {
    color: '#EF6C00',
  },
  vipText: {
    color: '#2E7D32',
  },
});
