import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../src/theme';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';
import { PAYMENT_STATUS_LABELS } from '../../src/constants';

const STATUS_COLORS: Record<string, { bg: string; text: string; border?: string }> = {
  PENDING: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  UNDER_REVIEW: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  PAID: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  REJECTED: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  OVERDUE: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

export default function PaymentsScreen() {
  const [payments, setPayments] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const data = await api.getPayments();
      setPayments(data);
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  // Separate payments by status
  const overduePayments = payments.filter(p => p.status === 'OVERDUE');
  const pendingPayments = payments.filter(p => p.status === 'PENDING');
  const currentPayment = overduePayments[0] || pendingPayments[0];
  const upcomingPayment = pendingPayments.length > 1 ? pendingPayments[1] : null;
  const historyPayments = payments.filter(p => !['PENDING', 'OVERDUE'].includes(p.status));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Оплати</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : payments.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="wallet-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Немає рахунків</Text>
            <Text style={styles.emptyDesc}>
              Рахунки з'являться після призначення дитини в групу
            </Text>
          </View>
        ) : (
          <>
            {/* Current Invoice Block - Most Important */}
            {currentPayment && (
              <CurrentInvoiceBlock invoice={currentPayment} />
            )}

            {/* Upcoming Payment Block */}
            {upcomingPayment && (
              <UpcomingPaymentBlock next={upcomingPayment} />
            )}

            {/* Payment History Block */}
            {historyPayments.length > 0 && (
              <PaymentHistoryBlock history={historyPayments} />
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Current Invoice Block (MOST IMPORTANT)
function CurrentInvoiceBlock({ invoice }: { invoice: any }) {
  const isOverdue = invoice.status === 'OVERDUE';
  const statusColor = STATUS_COLORS[invoice.status] || STATUS_COLORS.PENDING;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'd MMMM yyyy', { locale: uk });
    } catch {
      return '';
    }
  };

  return (
    <View style={[
      styles.currentInvoiceCard,
      isOverdue && styles.currentInvoiceOverdue
    ]}>
      <View style={styles.invoiceHeader}>
        <Text style={styles.invoiceLabel}>Поточна оплата</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
          <Text style={[styles.statusText, { color: statusColor.text }]}>
            {isOverdue ? 'Прострочено' : PAYMENT_STATUS_LABELS[invoice.status] || 'Очікує'}
          </Text>
        </View>
      </View>

      <Text style={styles.invoiceAmount}>
        {invoice.amount?.toLocaleString()} ₴
      </Text>

      {invoice.child && (
        <Text style={styles.invoiceChild}>
          {invoice.child.firstName} {invoice.child.lastName || ''}
        </Text>
      )}

      {invoice.dueDate && (
        <Text style={[
          styles.invoiceDueDate,
          isOverdue && styles.invoiceDueDateOverdue
        ]}>
          {isOverdue ? 'Було до: ' : 'Сплатити до: '}{formatDate(invoice.dueDate)}
        </Text>
      )}

      {invoice.description && (
        <Text style={styles.invoiceDescription}>{invoice.description}</Text>
      )}

      <TouchableOpacity 
        style={[
          styles.invoiceButton,
          isOverdue && styles.invoiceButtonOverdue
        ]}
        onPress={() => router.push(`/payments/${invoice.id}`)}
        activeOpacity={0.8}
      >
        <Ionicons name="document-text-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.invoiceButtonText}>Переглянути деталі</Text>
      </TouchableOpacity>
    </View>
  );
}

// Upcoming Payment Block
function UpcomingPaymentBlock({ next }: { next: any }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'd MMMM', { locale: uk });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.upcomingCard}>
      <View style={styles.upcomingHeader}>
        <Ionicons name="calendar-outline" size={20} color="#6B7280" />
        <Text style={styles.upcomingTitle}>Наступна оплата</Text>
      </View>
      
      <View style={styles.upcomingContent}>
        <View>
          <Text style={styles.upcomingAmount}>{next.amount?.toLocaleString()} ₴</Text>
          {next.child && (
            <Text style={styles.upcomingChild}>{next.child.firstName}</Text>
          )}
        </View>
        {next.dueDate && (
          <Text style={styles.upcomingDate}>{formatDate(next.dueDate)}</Text>
        )}
      </View>
    </View>
  );
}

// Payment History Block
function PaymentHistoryBlock({ history }: { history: any[] }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'd MMM yyyy', { locale: uk });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.historySection}>
      <Text style={styles.sectionTitle}>Історія оплат</Text>

      {history.map((payment) => {
        const statusColor = STATUS_COLORS[payment.status] || STATUS_COLORS.PAID;
        const isPaid = payment.status === 'PAID';

        return (
          <TouchableOpacity
            key={payment.id}
            style={styles.historyItem}
            onPress={() => router.push(`/payments/${payment.id}`)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.historyIcon,
              { backgroundColor: statusColor.bg }
            ]}>
              <Ionicons 
                name={isPaid ? 'checkmark-circle' : 'close-circle'} 
                size={20} 
                color={statusColor.text} 
              />
            </View>
            
            <View style={styles.historyInfo}>
              <Text style={styles.historyAmount}>{payment.amount?.toLocaleString()} ₴</Text>
              <Text style={styles.historyChild}>
                {payment.child?.firstName || 'Оплата'}
              </Text>
            </View>
            
            <View style={styles.historyRight}>
              <Text style={styles.historyDate}>{formatDate(payment.paidAt || payment.updatedAt)}</Text>
              <View style={[styles.historyBadge, { backgroundColor: statusColor.bg }]}>
                <Text style={[styles.historyBadgeText, { color: statusColor.text }]}>
                  {PAYMENT_STATUS_LABELS[payment.status] || payment.status}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },

  // Current Invoice Block
  currentInvoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  currentInvoiceOverdue: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceAmount: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
    marginBottom: 4,
  },
  invoiceChild: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 8,
  },
  invoiceDueDate: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '500',
    marginBottom: 8,
  },
  invoiceDueDateOverdue: {
    color: '#DC2626',
  },
  invoiceDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  invoiceButton: {
    flexDirection: 'row',
    backgroundColor: '#000',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceButtonOverdue: {
    backgroundColor: '#DC2626',
  },
  invoiceButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Upcoming Payment Block
  upcomingCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  upcomingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  upcomingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  upcomingContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  upcomingChild: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  upcomingDate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },

  // History Section
  historySection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  historyChild: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  historyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
