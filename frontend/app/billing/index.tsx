import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { format, differenceInDays, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

interface Invoice {
  _id: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'PENDING_REVIEW';
  dueDate: string;
  paidAt?: string;
  childId?: { firstName: string; lastName: string };
  description?: string;
}

interface Subscription {
  _id: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED';
  planName: string;
  price: number;
  nextBillingDate: string;
  childId?: { firstName: string; lastName: string };
}

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

function InvoiceCard({ invoice, onPress }: { invoice: Invoice; onPress: () => void }) {
  const dueDate = parseISO(invoice.dueDate);
  const daysOverdue = differenceInDays(new Date(), dueDate);
  const isOverdue = daysOverdue > 0 && invoice.status !== 'PAID';

  return (
    <TouchableOpacity style={styles.invoiceCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.invoiceHeader}>
        <View>
          <Text style={styles.invoiceAmount}>{invoice.amount} грн</Text>
          <Text style={styles.invoiceChild}>
            {invoice.childId ? `${invoice.childId.firstName} ${invoice.childId.lastName}` : 'Абонемент'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
            {getStatusText(invoice.status)}
          </Text>
        </View>
      </View>

      <View style={styles.invoiceFooter}>
        <Text style={styles.invoiceDate}>
          {isOverdue && invoice.status !== 'PAID' 
            ? `Прострочено ${daysOverdue} дн.`
            : `До ${format(dueDate, 'd MMMM', { locale: uk })}`
          }
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );
}

function SubscriptionCard({ subscription, onPress }: { subscription: Subscription; onPress: () => void }) {
  const nextDate = subscription.nextBillingDate ? parseISO(subscription.nextBillingDate) : null;

  return (
    <TouchableOpacity style={styles.subscriptionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.subscriptionHeader}>
        <View style={styles.subscriptionIcon}>
          <Ionicons 
            name={subscription.status === 'ACTIVE' ? 'card' : 'pause-circle'} 
            size={24} 
            color={subscription.status === 'ACTIVE' ? '#22C55E' : '#F59E0B'} 
          />
        </View>
        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionName}>{subscription.planName}</Text>
          <Text style={styles.subscriptionChild}>
            {subscription.childId ? `${subscription.childId.firstName} ${subscription.childId.lastName}` : ''}
          </Text>
        </View>
        <Text style={styles.subscriptionPrice}>{subscription.price} грн/міс</Text>
      </View>

      {nextDate && subscription.status === 'ACTIVE' && (
        <Text style={styles.nextBilling}>
          Наступна оплата: {format(nextDate, 'd MMMM', { locale: uk })}
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function BillingScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'invoices' | 'subscriptions'>('invoices');

  const { data: invoices, isLoading: loadingInvoices, refetch: refetchInvoices } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.getInvoices(),
  });

  const { data: subscriptions, isLoading: loadingSubs, refetch: refetchSubs } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => api.getSubscriptions(),
  });

  const onRefresh = useCallback(() => {
    refetchInvoices();
    refetchSubs();
  }, []);

  const pendingInvoices = invoices?.filter((i: Invoice) => ['PENDING', 'OVERDUE'].includes(i.status)) || [];
  const paidInvoices = invoices?.filter((i: Invoice) => i.status === 'PAID') || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Оплата</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'invoices' && styles.tabActive]}
          onPress={() => setActiveTab('invoices')}
        >
          <Text style={[styles.tabText, activeTab === 'invoices' && styles.tabTextActive]}>
            Рахунки
          </Text>
          {pendingInvoices.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingInvoices.length}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'subscriptions' && styles.tabActive]}
          onPress={() => setActiveTab('subscriptions')}
        >
          <Text style={[styles.tabText, activeTab === 'subscriptions' && styles.tabTextActive]}>
            Підписки
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loadingInvoices || loadingSubs} onRefresh={onRefresh} />
        }
      >
        {activeTab === 'invoices' ? (
          <>
            {/* Pending Invoices */}
            {pendingInvoices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>До оплати</Text>
                {pendingInvoices.map((invoice: Invoice) => (
                  <InvoiceCard
                    key={invoice._id}
                    invoice={invoice}
                    onPress={() => router.push(`/billing/invoice/${invoice._id}`)}
                  />
                ))}
              </View>
            )}

            {/* Paid Invoices */}
            {paidInvoices.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Історія</Text>
                {paidInvoices.slice(0, 5).map((invoice: Invoice) => (
                  <InvoiceCard
                    key={invoice._id}
                    invoice={invoice}
                    onPress={() => router.push(`/billing/invoice/${invoice._id}`)}
                  />
                ))}
              </View>
            )}

            {invoices?.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Немає рахунків</Text>
                <Text style={styles.emptyText}>Рахунки з'являться автоматично</Text>
              </View>
            )}
          </>
        ) : (
          <>
            {subscriptions?.map((sub: Subscription) => (
              <SubscriptionCard
                key={sub._id}
                subscription={sub}
                onPress={() => router.push(`/billing/subscription/${sub._id}`)}
              />
            ))}

            {subscriptions?.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="card-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>Немає підписок</Text>
                <Text style={styles.emptyText}>Підписки створюються адміном</Text>
              </View>
            )}
          </>
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#0F0F10',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  invoiceCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  invoiceAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F0F10',
  },
  invoiceChild: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  invoiceDate: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  subscriptionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subscriptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F10',
  },
  subscriptionChild: {
    fontSize: 13,
    color: '#6B7280',
  },
  subscriptionPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F10',
  },
  nextBilling: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0F0F10',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
});
