import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  NEW: { label: 'Нове', color: '#6B7280', bg: '#F3F4F6', icon: 'time-outline' },
  PENDING: { label: 'Очікує', color: '#F59E0B', bg: '#FEF3C7', icon: 'time-outline' },
  PENDING_PAYMENT: { label: 'Очікує оплати', color: '#F59E0B', bg: '#FEF3C7', icon: 'card-outline' },
  PAID: { label: 'Оплачено', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  PROCESSING: { label: 'В обробці', color: '#3B82F6', bg: '#DBEAFE', icon: 'sync-outline' },
  READY: { label: 'Готово', color: '#8B5CF6', bg: '#EDE9FE', icon: 'cube-outline' },
  DELIVERED: { label: 'Доставлено', color: '#10B981', bg: '#D1FAE5', icon: 'checkmark-done-outline' },
  DONE: { label: 'Завершено', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-done' },
  CANCELLED: { label: 'Скасовано', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' },
  CANCELED: { label: 'Скасовано', color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

export default function OrdersScreen() {
  const router = useRouter();

  const { data: orders, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-orders'],
    queryFn: () => api.get('/shop/orders'),
  });

  if (isLoading) return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  const ordersList = orders || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Мої замовлення</Text>
        <View style={{ width: 44 }} />
      </View>

      {ordersList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="bag-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Замовлень ще немає</Text>
          <Text style={styles.emptySubtitle}>Перше замовлення чекає на вас</Text>
          <TouchableOpacity testID="go-shop" style={styles.goShopBtn} onPress={() => router.back()}>
            <Text style={styles.goShopText}>До магазину</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {ordersList.map((order: any) => {
            const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.NEW;
            const date = order.createdAt ? new Date(order.createdAt).toLocaleDateString('uk-UA') : '';
            const itemsCount = (order.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);
            const orderId = (order._id || order.id || '').toString();

            return (
              <TouchableOpacity
                key={orderId}
                testID={`order-${orderId}`}
                style={styles.orderCard}
                onPress={() => router.push(`/marketplace/order/${orderId}`)}
              >
                <View style={styles.orderHeader}>
                  <Text style={styles.orderNumber}>#{orderId.slice(-6).toUpperCase()}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Ionicons name={st.icon as any} size={14} color={st.color} />
                    <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <View style={styles.orderBody}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderDate}>{date}</Text>
                    <Text style={styles.orderItems}>{itemsCount} товар(ів)</Text>
                  </View>
                  <Text style={styles.orderTotal}>{order.totalAmount} ₴</Text>
                </View>
                <View style={styles.orderProducts}>
                  {(order.items || []).slice(0, 3).map((item: any, idx: number) => (
                    <Text key={idx} style={styles.productName} numberOfLines={1}>
                      {item.name || 'Товар'} × {item.quantity}
                    </Text>
                  ))}
                  {(order.items || []).length > 3 && (
                    <Text style={styles.moreItems}>+{(order.items || []).length - 3} ще</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  orderCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNumber: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
  orderBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  orderInfo: { gap: 2 },
  orderDate: { fontSize: 13, color: colors.textSecondary },
  orderItems: { fontSize: 13, color: colors.textSecondary },
  orderTotal: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  orderProducts: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  productName: { fontSize: 13, color: '#4B5563', marginBottom: 2 },
  moreItems: { fontSize: 12, color: colors.primary, fontWeight: '500', marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F10', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  goShopBtn: { marginTop: 24, backgroundColor: '#E30613', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  goShopText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
