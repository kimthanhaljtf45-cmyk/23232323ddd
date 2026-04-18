import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

type Segment = 'VIP' | 'ACTIVE' | 'WARNING' | 'CHURN_RISK';

interface Props {
  segment: Segment;
}

const stylesMap: Record<Segment, { bg: string; color: string; label: string }> = {
  VIP: { bg: '#E8F5E9', color: '#2E7D32', label: 'VIP' },
  ACTIVE: { bg: '#E3F2FD', color: '#1565C0', label: 'Активний' },
  WARNING: { bg: '#FFF3E0', color: '#EF6C00', label: 'Увага' },
  CHURN_RISK: { bg: '#FDECEC', color: '#C62828', label: 'Ризик відтоку' },
};

export default function SegmentBadge({ segment }: Props) {
  const style = stylesMap[segment] || stylesMap.ACTIVE;

  return (
    <View style={[styles.badge, { backgroundColor: style.bg }]}>
      <Text style={[styles.text, { color: style.color }]}>
        {style.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  text: {
    fontWeight: '700',
    fontSize: 12,
  },
});
