import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../src/theme';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PAYMENT_STATUS_LABELS } from '../../src/constants';
import { Button } from '../../src/components/ui';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: colors.warningLight, text: colors.warning },
  UNDER_REVIEW: { bg: colors.infoLight, text: colors.info },
  PAID: { bg: colors.successLight, text: colors.success },
  REJECTED: { bg: colors.errorLight, text: colors.error },
};

export default function PaymentDetail() {
  const { id: paymentId } = useLocalSearchParams<{ id: string }>();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (paymentId) loadPayment();
  }, [paymentId]);

  const loadPayment = async () => {
    try {
      setLoading(true);
      const data = await api.getPayment(paymentId!);
      setPayment(data);
    } catch (error) {
      console.error('Error loading payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    Alert.alert(
      'Підтвердження оплати',
      'Ви впевнені, що оплатили цей рахунок?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Підтвердити',
          onPress: async () => {
            try {
              setConfirming(true);
              await api.confirmPayment(paymentId!);
              Alert.alert(
                'Готово! ✅',
                'Оплату надіслано на перевірку',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              Alert.alert('Помилка', 'Не вдалося підтвердити оплату');
            } finally {
              setConfirming(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy', { locale: uk });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Рахунок</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!payment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Рахунок</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Рахунок не знайдено</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = STATUS_COLORS[payment.status] || STATUS_COLORS.PENDING;
  const isPending = payment.status === 'PENDING';
  const isUnderReview = payment.status === 'UNDER_REVIEW';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Рахунок</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>Сума до оплати</Text>
          <Text style={styles.amount}>{payment.amount?.toLocaleString()} ₴</Text>
          <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusTextLarge, { color: statusColor.text }]}>
              {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow label="Дитина" value={`${payment.child?.firstName} ${payment.child?.lastName || ''}`} />
          <DetailRow label="Опис" value={payment.description} />
          {payment.dueDate && (
            <DetailRow label="Сплатити до" value={formatDate(payment.dueDate)} />
          )}
          {payment.group && (
            <DetailRow label="Група" value={payment.group.name} />
          )}
        </View>

        {/* Payment Instructions */}
        {isPending && (
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>💳 Реквізити для оплати</Text>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionLabel}>Картка ПриватБанк:</Text>
              <Text style={styles.instructionValue}>4149 4999 1234 5678</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionLabel}>Отримувач:</Text>
              <Text style={styles.instructionValue}>Костенко О.В.</Text>
            </View>
            <View style={styles.instructionItem}>
              <Text style={styles.instructionLabel}>Призначення:</Text>
              <Text style={styles.instructionValue}>Абонемент {payment.child?.firstName}</Text>
            </View>
          </View>
        )}

        {/* Status Messages */}
        {isUnderReview && (
          <View style={styles.statusCard}>
            <Text style={styles.statusIcon}>⏳</Text>
            <Text style={styles.statusMessage}>
              Оплата на перевірці. Очікуйте підтвердження від адміністратора.
            </Text>
          </View>
        )}

        {payment.status === 'PAID' && (
          <View style={[styles.statusCard, { backgroundColor: colors.successLight }]}>
            <Text style={styles.statusIcon}>✅</Text>
            <Text style={styles.statusMessage}>
              Оплату підтверджено. Дякуємо!
            </Text>
          </View>
        )}

        {payment.status === 'REJECTED' && (
          <View style={[styles.statusCard, { backgroundColor: colors.errorLight }]}>
            <Text style={styles.statusIcon}>❌</Text>
            <Text style={styles.statusMessage}>
              Оплату відхилено. Зверніться до адміністратора.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm Button */}
      {isPending && (
        <View style={styles.footer}>
          <Button
            title="Підтвердити оплату"
            onPress={handleConfirm}
            loading={confirming}
            size="lg"
          />
          <Text style={styles.footerHint}>
            Після оплати натисніть "Підтвердити"
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  amountCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  amountLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  amount: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    color: colors.text,
    marginVertical: spacing.sm,
  },
  statusBadgeLarge: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginTop: spacing.sm,
  },
  statusTextLarge: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
  },
  detailsCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  instructionsCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  instructionsTitle: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  instructionItem: {
    marginBottom: spacing.sm,
  },
  instructionLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  instructionValue: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
    marginTop: 2,
  },
  statusCard: {
    backgroundColor: colors.infoLight,
    borderRadius: borderRadius.xl,
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  statusIcon: {
    fontSize: 24,
  },
  statusMessage: {
    flex: 1,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerHint: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
