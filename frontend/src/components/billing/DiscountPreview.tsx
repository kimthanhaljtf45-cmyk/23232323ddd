import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AppliedRule {
  name: string;
  type: string;
  valueType: string;
  value: number;
  discountAmount: number;
}

interface Props {
  baseAmount: number;
  discountAmount: number;
  finalAmount: number;
  appliedRules: AppliedRule[];
  freeMonths?: number;
}

export default function DiscountPreview({
  baseAmount,
  discountAmount,
  finalAmount,
  appliedRules,
  freeMonths,
}: Props) {
  const hasDiscount = discountAmount > 0 || (freeMonths && freeMonths > 0);

  return (
    <View style={styles.container}>
      {/* Base Price */}
      <View style={styles.row}>
        <Text style={styles.label}>Базова ціна:</Text>
        <Text style={styles.value}>{baseAmount.toLocaleString()} грн</Text>
      </View>

      {/* Applied Discounts */}
      {appliedRules.map((rule, index) => (
        <View key={index} style={styles.discountRow}>
          <View style={styles.discountIcon}>
            <Ionicons name="pricetag" size={14} color="#22C55E" />
          </View>
          <Text style={styles.discountLabel}>{rule.name}:</Text>
          <Text style={styles.discountValue}>
            -{rule.valueType === 'PERCENT' ? `${rule.value}%` : `${rule.discountAmount.toLocaleString()} грн`}
          </Text>
        </View>
      ))}

      {/* Free Months */}
      {freeMonths && freeMonths > 0 && (
        <View style={styles.freeMonthsRow}>
          <Ionicons name="gift" size={18} color="#8B5CF6" />
          <Text style={styles.freeMonthsText}>
            +{freeMonths} безкоштовний місяць!
          </Text>
        </View>
      )}

      {/* Total Savings */}
      {hasDiscount && (
        <View style={styles.savingsRow}>
          <Text style={styles.savingsLabel}>Ваша економія:</Text>
          <Text style={styles.savingsValue}>
            -{discountAmount.toLocaleString()} грн
          </Text>
        </View>
      )}

      {/* Final Price */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>До сплати:</Text>
        <Text style={styles.finalValue}>
          {freeMonths && freeMonths > 0 ? '0' : finalAmount.toLocaleString()} грн
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    color: '#374151',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 6,
  },
  discountIcon: {
    width: 20,
    alignItems: 'center',
  },
  discountLabel: {
    flex: 1,
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '500',
  },
  discountValue: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '600',
  },
  freeMonthsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
    backgroundColor: '#F3E8FF',
    padding: 10,
    borderRadius: 10,
  },
  freeMonthsText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '700',
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  savingsLabel: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '600',
  },
  savingsValue: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '700',
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E5E7EB',
  },
  finalLabel: {
    fontSize: 18,
    color: '#0F0F10',
    fontWeight: '700',
  },
  finalValue: {
    fontSize: 20,
    color: '#E30613',
    fontWeight: '800',
  },
});
