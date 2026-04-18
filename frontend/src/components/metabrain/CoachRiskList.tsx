import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import SegmentBadge from './SegmentBadge';

type Segment = 'VIP' | 'ACTIVE' | 'WARNING' | 'CHURN_RISK';

interface RiskItem {
  id: string;
  name: string;
  segment: Segment;
  reason: string;
}

interface Props {
  items: RiskItem[];
}

export default function CoachRiskList({ items }: Props) {
  if (!items || items.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.header}>Учні в ризику</Text>
        <Text style={styles.emptyText}>Всі учні в порядку!</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.header}>Учні в ризику</Text>

      {items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemReason}>{item.reason}</Text>
          <View style={styles.badgeContainer}>
            <SegmentBadge segment={item.segment} />
          </View>
        </View>
      ))}
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
    marginBottom: 12,
  },
  emptyText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '500',
  },
  item: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F1F1',
  },
  itemName: {
    fontWeight: '700',
    color: '#111',
  },
  itemReason: {
    marginTop: 4,
    color: '#666',
  },
  badgeContainer: {
    marginTop: 8,
  },
});
