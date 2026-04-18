import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { format, parseISO, differenceInDays } from 'date-fns';
import { uk } from 'date-fns/locale';
import { DiscountPreview, PromoCodeInput } from '../../../src/components/billing';

function getStatusColor(status: string): string {
  switch (status) {
    case 'PAID': return '#22C55E';
    case 'PENDING': return '#F59E0B';
    case 'OVERDUE': return '#EF4444';
    case 'PENDING_REVIEW': return '#3B82F6';
    default: return '#6B7280';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'PAID': return 'Оплачено';
    case 'PENDING': return 'Очікує оплату';
    case 'OVERDUE': return 'Прострочено';
    case 'PENDING_REVIEW': return 'На перевірці';
    default: return status;
  }
}

interface DiscountResult {
  baseAmount: number;
  totalDiscountPercent: number;
  totalDiscountFixed: number;
  discountAmount: number;
  finalAmount: number;
  appliedRules: Array<{
    ruleId: string;
    name: string;
    type: string;
    valueType: string;
    value: number;
    discountAmount: number;
  }>;
  freeMonths?: number;
}

export default function InvoiceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [proofUrl, setProofUrl] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | undefined>();
  const [discountData, setDiscountData] = useState<DiscountResult | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.getInvoice(id || ''),
    enabled: !!id,
  });

  // Calculate discounts when invoice loads
  useEffect(() => {
    if (invoice && ['PENDING', 'OVERDUE'].includes(invoice.status)) {
      calculateDiscounts();
    }
  }, [invoice?._id, appliedPromoCode]);

  const calculateDiscounts = async () => {
    if (!invoice) return;
    
    try {
      const result = await api.post('/discounts/calculate', {
        baseAmount: invoice.amount,
        childId: invoice.childId?._id,
        context: 'INVOICE',
        promoCode: appliedPromoCode,
      });
      setDiscountData(result);
    } catch (error) {
      console.log('Error calculating discounts:', error);
      // Silent fail - discounts are optional
    }
  };

  const handlePromoCodeApply = async (code: string): Promise<{ valid: boolean; message?: string }> => {
    try {
      const result = await api.post('/discounts/validate-promo', { promoCode: code });
      if (result.valid) {
        setAppliedPromoCode(code);
        return { valid: true };
      }
      return { valid: false, message: result.message };
    } catch (error: any) {
      return { valid: false, message: error.response?.data?.message || 'Помилка перевірки' };
    }
  };

  const uploadMutation = useMutation({
    mutationFn: (url: string) => api.uploadPaymentProof(id || '', url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      Alert.alert('Успішно', 'Підтвердження завантажено');
    },
    onError: () => {
      Alert.alert('Помилка', 'Не вдалося завантажити підтвердження');
    },
  });

  // WayForPay payment mutation
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const result = await api.post('/wayforpay/payment-url', { invoiceId: id });
      return result.paymentUrl;
    },
    onSuccess: async (paymentUrl: string) => {
      // Open WayForPay payment page
      const supported = await Linking.canOpenURL(paymentUrl);
      if (supported) {
        await Linking.openURL(paymentUrl);
      } else {
        Alert.alert('Помилка', 'Не вдалося відкрити сторінку оплати');
      }
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Не вдалося створити платіж';
      Alert.alert('Помилка', message);
    },
  });

  // Simulate payment (TEST MODE)
  const simulateMutation = useMutation({
    mutationFn: () => api.post('/wayforpay/simulate', { invoiceId: id, success: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      Alert.alert('Тестова оплата', 'Симуляція успішної оплати завершена!');
    },
    onError: () => {
      Alert.alert('Помилка', 'Не вдалося симулювати оплату');
    },
  });

  const handleUploadProof = () => {
    if (!proofUrl.trim()) {
      Alert.alert('Помилка', 'Введіть посилання на чек');
      return;
    }
    uploadMutation.mutate(proofUrl);
  };

  if (isLoading || !invoice) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const dueDate = parseISO(invoice.dueDate);
  const daysOverdue = differenceInDays(new Date(), dueDate);
  const showUpload = ['PENDING', 'OVERDUE'].includes(invoice.status);
  const finalAmount = discountData?.finalAmount ?? invoice.amount;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Рахунок</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Amount Card */}
        <View style={styles.amountCard}>
          <Text style={styles.amountLabel}>До сплати</Text>
          <Text style={styles.amountValue}>{finalAmount.toLocaleString()} грн</Text>
          {discountData && discountData.discountAmount > 0 && (
            <Text style={styles.originalPrice}>
              замість {invoice.amount.toLocaleString()} грн
            </Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
              {getStatusText(invoice.status)}
            </Text>
          </View>
        </View>

        {/* Discount Preview - BILLING CHECKOUT KEY FEATURE */}
        {discountData && discountData.appliedRules.length > 0 && showUpload && (
          <DiscountPreview
            baseAmount={discountData.baseAmount}
            discountAmount={discountData.discountAmount}
            finalAmount={discountData.finalAmount}
            appliedRules={discountData.appliedRules}
            freeMonths={discountData.freeMonths}
          />
        )}

        {/* Promo Code Input - Only show for pending invoices */}
        {showUpload && (
          <PromoCodeInput
            onApply={handlePromoCodeApply}
            appliedCode={appliedPromoCode}
          />
        )}

        {/* Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Дитина</Text>
            <Text style={styles.detailValue}>
              {invoice.childId?.firstName} {invoice.childId?.lastName}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Опис</Text>
            <Text style={styles.detailValue}>{invoice.description || 'Місячний абонемент'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Дата оплати</Text>
            <Text style={[styles.detailValue, daysOverdue > 0 && invoice.status !== 'PAID' && { color: '#EF4444' }]}>
              {format(dueDate, 'd MMMM yyyy', { locale: uk })}
            </Text>
          </View>
          {invoice.paidAt && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Оплачено</Text>
              <Text style={styles.detailValue}>
                {format(parseISO(invoice.paidAt), 'd MMMM yyyy', { locale: uk })}
              </Text>
            </View>
          )}
        </View>

        {/* Upload Proof */}
        {showUpload && (
          <View style={styles.uploadCard}>
            {/* WayForPay Payment Button - PRIMARY */}
            <View style={styles.wayforpaySection}>
              <TouchableOpacity
                style={[styles.wayforpayButton, paymentMutation.isPending && styles.uploadButtonDisabled]}
                onPress={() => paymentMutation.mutate()}
                disabled={paymentMutation.isPending}
              >
                {paymentMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.wayforpayButtonText}>
                      Оплатити карткою {finalAmount.toLocaleString()} грн
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.wayforpayHint}>
                WayForPay • Visa/Mastercard • Apple Pay • Google Pay
              </Text>
              
              {/* Test mode button */}
              <TouchableOpacity
                style={styles.testPayButton}
                onPress={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending}
              >
                {simulateMutation.isPending ? (
                  <ActivityIndicator color="#22C55E" size="small" />
                ) : (
                  <Text style={styles.testPayText}>Симулювати оплату (тест)</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.orDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>або</Text>
              <View style={styles.dividerLine} />
            </View>

            <Text style={styles.uploadTitle}>Завантажити чек (ручна оплата)</Text>
            <Text style={styles.uploadDesc}>
              Введіть посилання на скріншот оплати (або завантажте в хмару)
            </Text>
            <TextInput
              style={styles.proofInput}
              placeholder="https://..."
              placeholderTextColor="#9CA3AF"
              value={proofUrl}
              onChangeText={setProofUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.uploadButton, uploadMutation.isPending && styles.uploadButtonDisabled]}
              onPress={handleUploadProof}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.uploadButtonText}>
                  Відправити на перевірку
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {invoice.status === 'PENDING_REVIEW' && (
          <View style={styles.pendingReviewCard}>
            <Ionicons name="hourglass-outline" size={24} color="#3B82F6" />
            <Text style={styles.pendingReviewText}>
              Ваш чек на перевірці. Ми повідомимо про результат.
            </Text>
          </View>
        )}

        {invoice.status === 'PAID' && (
          <View style={styles.paidCard}>
            <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
            <Text style={styles.paidText}>Оплату підтверджено. Дякуємо!</Text>
          </View>
        )}

        {/* Bank Details */}
        {showUpload && (
          <View style={styles.bankCard}>
            <Text style={styles.bankTitle}>Реквізити для оплати</Text>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>IBAN</Text>
              <Text style={styles.bankValue}>UA21 3052 9900 0002 6007 0507 6952 1</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Отримувач</Text>
              <Text style={styles.bankValue}>ФОП Петренко О.О.</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Призначення</Text>
              <Text style={styles.bankValue}>Абонемент {invoice.childId?.firstName}</Text>
            </View>
            <View style={styles.bankRow}>
              <Text style={styles.bankLabel}>Сума</Text>
              <Text style={[styles.bankValue, styles.bankAmount]}>
                {finalAmount.toLocaleString()} грн
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  amountCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  amountLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  amountValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F10',
  },
  uploadCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  wayforpaySection: {
    marginBottom: 16,
  },
  wayforpayButton: {
    backgroundColor: '#22C55E',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wayforpayButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  wayforpayHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
  },
  testPayButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 8,
    borderStyle: 'dashed',
  },
  testPayText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '500',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#9CA3AF',
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  uploadDesc: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  proofInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F0F10',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploadButton: {
    backgroundColor: '#6B7280',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  uploadButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pendingReviewCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  pendingReviewText: {
    flex: 1,
    fontSize: 14,
    color: '#1E40AF',
  },
  paidCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  paidText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#166534',
  },
  bankCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  bankTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  bankRow: {
    marginBottom: 8,
  },
  bankLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  bankValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0F0F10',
  },
  bankAmount: {
    color: '#E30613',
    fontWeight: '700',
    fontSize: 16,
  },
});
