import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';

interface AppliedRule {
  name: string;
  type: string;
  valueType: string;
  value: number;
  discountAmount: number;
}

interface Props {
  baseAmount: number;
  finalAmount: number;
  discountAmount: number;
  totalDiscountPercent: number;
  appliedRules: AppliedRule[];
  freeMonths?: number;
  currency?: string;
}

export default function DiscountSummary({
  baseAmount,
  finalAmount,
  discountAmount,
  totalDiscountPercent,
  appliedRules,
  freeMonths,
  currency = '\u0433\u0440\u043D',
}: Props) {
  if (appliedRules.length === 0 && !freeMonths) {
    return null;
  }

  const getDiscountLabel = (rule: AppliedRule) => {
    if (rule.valueType === 'PERCENT') {
      return `-${rule.value}%`;
    } else if (rule.valueType === 'FIXED') {
      return `-${rule.value} ${currency}`;
    } else if (rule.valueType === 'FREE_PERIOD') {
      return `${rule.value} \u043C\u0456\u0441. \u0431\u0435\u0437\u043A\u043E\u0448\u0442\u043E\u0432\u043D\u043E`;
    }
    return '';
  };

  return (
    <View style={styles.container}>
      {/* Base Amount */}
      <View style={styles.row}>
        <Text style={styles.label}>\u0411\u0430\u0437\u043E\u0432\u0430 \u0446\u0456\u043D\u0430</Text>
        <Text style={styles.value}>{baseAmount.toLocaleString()} {currency}</Text>
      </View>

      {/* Applied Discounts */}
      {appliedRules.map((rule, index) => (
        <View key={index} style={styles.discountRow}>
          <View style={styles.discountLeft}>
            <Ionicons name="pricetag" size={16} color={colors.success} />
            <Text style={styles.discountName}>{rule.name}</Text>
          </View>
          <Text style={styles.discountValue}>{getDiscountLabel(rule)}</Text>
        </View>
      ))}

      {/* Free Months */}
      {freeMonths && freeMonths > 0 && (
        <View style={styles.freeMonthsBox}>
          <Ionicons name="gift" size={20} color={colors.primary} />
          <Text style={styles.freeMonthsText}>
            {freeMonths} {freeMonths === 1 ? '\u043C\u0456\u0441\u044F\u0446\u044C' : '\u043C\u0456\u0441\u044F\u0446\u0456'} \u0431\u0435\u0437\u043A\u043E\u0448\u0442\u043E\u0432\u043D\u043E!
          </Text>
        </View>
      )}

      {/* Total Discount */}
      {discountAmount > 0 && (
        <View style={styles.totalDiscountRow}>
          <Text style={styles.totalDiscountLabel}>\u0417\u0430\u0433\u0430\u043B\u044C\u043D\u0430 \u0437\u043D\u0438\u0436\u043A\u0430</Text>
          <Text style={styles.totalDiscountValue}>
            -{discountAmount.toLocaleString()} {currency}
            {totalDiscountPercent > 0 && ` (-${totalDiscountPercent.toFixed(0)}%)`}
          </Text>
        </View>
      )}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Final Amount */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>\u0414\u043E \u043E\u043F\u043B\u0430\u0442\u0438</Text>
        <Text style={styles.finalValue}>
          {finalAmount.toLocaleString()} {currency}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginVertical: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  value: {
    fontSize: fontSizes.base,
    color: colors.text,
    fontWeight: '500',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  discountLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  discountName: {
    fontSize: fontSizes.sm,
    color: colors.text,
    fontWeight: '500',
  },
  discountValue: {
    fontSize: fontSizes.sm,
    color: colors.success,
    fontWeight: '700',
  },
  freeMonthsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  freeMonthsText: {
    fontSize: fontSizes.base,
    fontWeight: '700',
    color: colors.primary,
  },
  totalDiscountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  totalDiscountLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  totalDiscountValue: {
    fontSize: fontSizes.sm,
    color: colors.success,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalLabel: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  finalValue: {
    fontSize: fontSizes.xl,
    fontWeight: '800',
    color: colors.primary,
  },
});
