import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../../src/lib/api';

/**
 * ADMIN INVOICES - Invoice Management
 * 
 * Features:
 * - List all invoices with status
 * - Filter by status (PENDING, PAID, OVERDUE)
 * - Confirm manual payments
 * - Mark as overdue
 */

interface Invoice {
  id: string;
  invoiceNumber: string;
  studentName: string;
  childId: string;
  parentId: string;
  subscriptionId?: string;
  amount: number;
  discountAmount: number;
  finalAmount: number;
  status: string;
  dueDate: string;
  paidAt?: string;
  description?: string;
  wayforpayOrderReference?: string;
}

export default function AdminInvoicesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    try {
      const response = await api.get('/admin/subscriptions/invoices');
      setInvoices(response || []);
    } catch (error) {
      console.log('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  }, [fetchInvoices]);

  const handleConfirmPayment = async (invoice: Invoice) => {
    Alert.alert(
      'Підтвердити оплату',
      `Підтвердити оплату ${invoice.invoiceNumber} на суму ${formatCurrency(invoice.finalAmount)}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Підтвердити',
          onPress: async () => {
            setActionLoading(invoice.id);
            try {
              await api.put(`/admin/subscriptions/invoices/${invoice.id}/confirm`, {
                adminNote: 'Оплата підтверджена адміністратором',
              });
              Alert.alert('Успіх', 'Оплату підтверджено');
              fetchInvoices();
            } catch (error: any) {
              Alert.alert('Помилка', error.message || 'Не вдалося підтвердити');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const handleMarkOverdue = async (invoice: Invoice) => {
    Alert.alert(
      'Позначити як прострочений',
      `Позначити ${invoice.invoiceNumber} як прострочений?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Підтвердити',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(invoice.id);
            try {
              await api.put(`/admin/subscriptions/invoices/${invoice.id}/overdue`);
              Alert.alert('Успіх', 'Позначено як прострочений');
              fetchInvoices();
            } catch (error: any) {
              Alert.alert('Помилка', error.message || 'Не вдалося оновити');
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID': return '#22C55E';
      case 'PENDING': return '#F59E0B';
      case 'OVERDUE': return '#EF4444';
      case 'FAILED': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PAID: 'Оплачено',
      PENDING: 'Очікує',
      OVERDUE: 'Прострочено',
      FAILED: 'Помилка',
      CREATED: 'Створено',
    };
    return labels[status] || status;
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('uk-UA');
  const formatCurrency = (amount: number) => amount.toLocaleString('uk-UA') + ' ₴';

  const filteredInvoices = filter === 'all'
    ? invoices
    : invoices.filter(i => i.status === filter);

  // Stats
  const stats = {
    pending: invoices.filter(i => i.status === 'PENDING').length,
    overdue: invoices.filter(i => i.status === 'OVERDUE').length,
    paid: invoices.filter(i => i.status === 'PAID').length,
    totalPending: invoices
      .filter(i => i.status === 'PENDING')
      .reduce((sum, i) => sum + i.finalAmount, 0),
    totalOverdue: invoices
      .filter(i => i.status === 'OVERDUE')
      .reduce((sum, i) => sum + i.finalAmount, 0),
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.filtersContainer} 
        contentContainerStyle={styles.filters}
      >
        {[
          { key: 'all', label: 'Всі', count: invoices.length },
          { key: 'PENDING', label: 'Очікують', count: stats.pending },
          { key: 'OVERDUE', label: 'Прострочені', count: stats.overdue },
          { key: 'PAID', label: 'Оплачені', count: stats.paid },
        ].map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label} ({f.count})
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.summaryAmount, { color: '#92400E' }]}>
              {formatCurrency(stats.totalPending)}
            </Text>
            <Text style={styles.summaryLabel}>очікують оплату</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.summaryAmount, { color: '#991B1B' }]}>
              {formatCurrency(stats.totalOverdue)}
            </Text>
            <Text style={styles.summaryLabel}>прострочено</Text>
          </View>
        </View>

        {/* Invoices List */}
        {filteredInvoices.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Немає рахунків</Text>
          </View>
        ) : (
          filteredInvoices.map((invoice) => (
            <View key={invoice.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderLeft}>
                  <Text style={styles.invoiceNumber}>{invoice.invoiceNumber}</Text>
                  <Text style={styles.studentName}>{invoice.studentName}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(invoice.status) }]}>
                    {getStatusLabel(invoice.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.amountBlock}>
                  <Text style={styles.amountLabel}>Сума</Text>
                  <Text style={styles.amountValue}>{formatCurrency(invoice.finalAmount)}</Text>
                  {invoice.discountAmount > 0 && (
                    <Text style={styles.discountNote}>
                      -{formatCurrency(invoice.discountAmount)} знижка
                    </Text>
                  )}
                </View>
                <View style={styles.dateBlock}>
                  <Text style={styles.dateLabel}>Термін</Text>
                  <Text style={[
                    styles.dateValue,
                    invoice.status === 'OVERDUE' && { color: '#EF4444' }
                  ]}>
                    {formatDate(invoice.dueDate)}
                  </Text>
                </View>
                {invoice.paidAt && (
                  <View style={styles.dateBlock}>
                    <Text style={styles.dateLabel}>Оплачено</Text>
                    <Text style={[styles.dateValue, { color: '#22C55E' }]}>
                      {formatDate(invoice.paidAt)}
                    </Text>
                  </View>
                )}
              </View>

              {invoice.description && (
                <Text style={styles.description}>{invoice.description}</Text>
              )}

              {/* Actions */}
              {invoice.status !== 'PAID' && (
                <View style={styles.cardActions}>
                  {invoice.status === 'PENDING' && (
                    <>
                      <Pressable
                        style={[styles.cardAction, { backgroundColor: '#DCFCE7' }]}
                        onPress={() => handleConfirmPayment(invoice)}
                        disabled={actionLoading === invoice.id}
                      >
                        {actionLoading === invoice.id ? (
                          <ActivityIndicator size="small" color="#22C55E" />
                        ) : (
                          <>
                            <Ionicons name="checkmark" size={16} color="#166534" />
                            <Text style={[styles.cardActionText, { color: '#166534' }]}>Підтвердити оплату</Text>
                          </>
                        )}
                      </Pressable>
                      <Pressable
                        style={[styles.cardAction, { backgroundColor: '#FEE2E2' }]}
                        onPress={() => handleMarkOverdue(invoice)}
                        disabled={actionLoading === invoice.id}
                      >
                        <Ionicons name="alert" size={16} color="#991B1B" />
                        <Text style={[styles.cardActionText, { color: '#991B1B' }]}>Прострочено</Text>
                      </Pressable>
                    </>
                  )}
                  {invoice.status === 'OVERDUE' && (
                    <Pressable
                      style={[styles.cardAction, { backgroundColor: '#DCFCE7' }]}
                      onPress={() => handleConfirmPayment(invoice)}
                      disabled={actionLoading === invoice.id}
                    >
                      {actionLoading === invoice.id ? (
                        <ActivityIndicator size="small" color="#22C55E" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={16} color="#166534" />
                          <Text style={[styles.cardActionText, { color: '#166534' }]}>Підтвердити оплату</Text>
                        </>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filtersContainer: { backgroundColor: '#fff', maxHeight: 60, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  filters: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#3B82F6' },
  filterText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  // Summary
  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 16 },
  summaryAmount: { fontSize: 20, fontWeight: '700' },
  summaryLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardHeaderLeft: {},
  invoiceNumber: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  studentName: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  // Body
  cardBody: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  amountBlock: {},
  amountLabel: { fontSize: 11, color: '#9CA3AF' },
  amountValue: { fontSize: 18, fontWeight: '700', color: '#0F0F10', marginTop: 2 },
  discountNote: { fontSize: 11, color: '#22C55E', marginTop: 2 },
  dateBlock: {},
  dateLabel: { fontSize: 11, color: '#9CA3AF' },
  dateValue: { fontSize: 14, color: '#0F0F10', marginTop: 2, fontWeight: '500' },
  description: { fontSize: 13, color: '#6B7280', fontStyle: 'italic', marginBottom: 12 },
  // Actions
  cardActions: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  cardActionText: { fontSize: 12, fontWeight: '600' },
});
