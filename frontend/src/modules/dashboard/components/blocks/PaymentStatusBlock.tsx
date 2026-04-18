import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface PaymentItem {
  id: string;
  childId: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  dueDate: string;
}

export function PaymentStatusBlock({ items }: { items: PaymentItem[] }) {
  if (items.length === 0) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return colors.error;
      case 'PENDING': return colors.warning;
      default: return colors.success;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="card" size={20} color={colors.warning} />
        <Text style={styles.title}>Оплати</Text>
      </View>
      <View style={styles.card}>
        {items.map((item, index) => (
          <View key={item.id} style={[styles.row, index > 0 && styles.rowBorder]}>
            <View style={styles.info}>
              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.dueDate}>До: {item.dueDate}</Text>
            </View>
            <View style={styles.amountContainer}>
              <Text style={[styles.amount, { color: getStatusColor(item.status) }]}>
                {item.amount} {item.currency}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  info: {
    flex: 1,
  },
  description: {
    ...typography.body,
    color: colors.text,
  },
  dueDate: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  amountContainer: {
    marginLeft: spacing.md,
  },
  amount: {
    ...typography.subtitle,
    fontWeight: '600',
  },
});
