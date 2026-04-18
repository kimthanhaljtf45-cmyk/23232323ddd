import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface Payment {
  id?: string;
  status: 'PENDING' | 'OVERDUE' | 'PAID' | 'PENDING_REVIEW';
  amount?: number;
  currency?: string;
  dueDate?: string;
  description?: string;
  childName?: string;
}

interface Props {
  payments: Payment[];
  totalPending?: number;
  totalOverdue?: number;
}

export function PaymentStatusBlock({ payments, totalPending = 0, totalOverdue = 0 }: Props) {
  const overduePayments = payments.filter(p => p.status === 'OVERDUE');
  const pendingPayments = payments.filter(p => p.status === 'PENDING' || p.status === 'PENDING_REVIEW');
  
  const hasIssues = overduePayments.length > 0 || pendingPayments.length > 0;
  
  if (!hasIssues) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.okContainer]}
        onPress={() => router.push('/payments')}
        activeOpacity={0.8}
      >
        <Ionicons name="checkmark-circle" size={24} color={colors.success} />
        <Text style={styles.okText}>Оплати в порядку</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.container}>
      {overduePayments.length > 0 && (
        <TouchableOpacity
          style={styles.overdueCard}
          onPress={() => router.push('/payments')}
          activeOpacity={0.8}
        >
          <View style={styles.iconBadge}>
            <Ionicons name="alert-circle" size={20} color="#fff" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.overdueTitle}>Прострочено</Text>
            <Text style={styles.overdueAmount}>
              {overduePayments.length} {overduePayments.length === 1 ? 'рахунок' : 'рахунки'}
            </Text>
          </View>
          <Text style={styles.ctaText}>Оплатити</Text>
        </TouchableOpacity>
      )}

      {pendingPayments.length > 0 && (
        <TouchableOpacity
          style={[styles.pendingCard, overduePayments.length > 0 && { marginTop: 8 }]}
          onPress={() => router.push('/payments')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconBadge, styles.pendingBadge]}>
            <Ionicons name="time" size={20} color="#000" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.pendingTitle}>Очікують оплати</Text>
            <Text style={styles.pendingSubtext}>
              {pendingPayments.length} {pendingPayments.length === 1 ? 'рахунок' : 'рахунки'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  okContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  okText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  overdueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FEF2F2',
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  overdueTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  overdueAmount: {
    fontSize: 13,
    color: '#B91C1C',
    marginTop: 2,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  pendingBadge: {
    backgroundColor: '#F3F4F6',
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  pendingSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
