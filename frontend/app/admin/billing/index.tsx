import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

type Invoice = {
  _id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PENDING_REVIEW';
  dueDate: string;
  proofUrl?: string;
  childId?: { firstName: string; lastName: string };
  parentId?: { firstName: string; lastName: string; phone: string };
};

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
    case 'PENDING': return 'Очікує';
    case 'OVERDUE': return 'Прострочено';
    case 'PENDING_REVIEW': return 'На перевірці';
    default: return status;
  }
}

export default function AdminBillingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>('all');

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ['admin-invoices'],
    queryFn: () => api.getInvoices(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.approveInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      Alert.alert('Успішно', 'Оплату підтверджено');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.rejectInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-invoices'] });
      Alert.alert('Успішно', 'Оплату відхилено');
    },
  });

  const handleApprove = (id: string) => {
    Alert.alert('Підтвердити оплату?', '', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Підтвердити', onPress: () => approveMutation.mutate(id) },
    ]);
  };

  const handleReject = (id: string) => {
    Alert.alert('Відхилити оплату?', '', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Відхилити', style: 'destructive', onPress: () => rejectMutation.mutate(id) },
    ]);
  };

  const filteredInvoices = invoices?.filter((inv: Invoice) => {
    if (filter === 'all') return true;
    return inv.status === filter;
  }) || [];

  const filters = [
    { key: 'all', label: 'Всі' },
    { key: 'PENDING_REVIEW', label: 'На перевірці' },
    { key: 'PENDING', label: 'Очікує' },
    { key: 'OVERDUE', label: 'Прострочено' },
    { key: 'PAID', label: 'Оплачено' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Billing</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
        <View style={styles.filters}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Table */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
      >
        {filteredInvoices.map((invoice: Invoice) => (
          <View key={invoice._id} style={styles.invoiceCard}>
            <View style={styles.invoiceHeader}>
              <View>
                <Text style={styles.invoiceName}>
                  {invoice.parentId?.firstName} {invoice.parentId?.lastName}
                </Text>
                <Text style={styles.invoiceChild}>
                  {invoice.childId?.firstName} {invoice.childId?.lastName}
                </Text>
              </View>
              <View style={styles.invoiceRight}>
                <Text style={styles.invoiceAmount}>{invoice.amount} грн</Text>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                    {getStatusText(invoice.status)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.invoiceMeta}>
              <Text style={styles.invoiceDate}>
                До: {format(parseISO(invoice.dueDate), 'd MMM yyyy', { locale: uk })}
              </Text>
              {invoice.proofUrl && (
                <TouchableOpacity style={styles.proofBtn}>
                  <Ionicons name="document-text-outline" size={16} color="#3B82F6" />
                  <Text style={styles.proofText}>Чек</Text>
                </TouchableOpacity>
              )}
            </View>

            {invoice.status === 'PENDING_REVIEW' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.approveBtn]}
                  onPress={() => handleApprove(invoice._id)}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                      <Text style={styles.actionBtnText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.rejectBtn]}
                  onPress={() => handleReject(invoice._id)}
                  disabled={rejectMutation.isPending}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                  <Text style={styles.actionBtnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        {filteredInvoices.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>Немає рахунків</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
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
  filtersScroll: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filters: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterBtnActive: {
    backgroundColor: '#0F0F10',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  invoiceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  invoiceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F10',
  },
  invoiceChild: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  invoiceAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  invoiceMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  invoiceDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  proofBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  proofText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  approveBtn: {
    backgroundColor: '#22C55E',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 12,
  },
});
