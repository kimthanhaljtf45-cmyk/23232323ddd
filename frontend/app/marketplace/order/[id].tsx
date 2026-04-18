import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { colors } from '../../../src/theme';

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

const DELIVERY_LABELS: Record<string, string> = {
  CLUB_PICKUP: 'Забрати в клубі',
  PICKUP: 'Самовивіз',
  NOVA_POSHTA: 'Нова Пошта',
  DELIVERY: 'Доставка',
};

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/shop/orders/${id}`),
    enabled: !!id,
  });

  if (isLoading) return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  if (!order) return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Замовлення не знайдено</Text>
      </View>
    </SafeAreaView>
  );

  const st = STATUS_CONFIG[order.status] || STATUS_CONFIG.NEW;
  const orderId = (order._id || order.id || id || '').toString();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Замовлення #{orderId.slice(-6).toUpperCase()}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Status */}
        <View style={[styles.statusCard, { backgroundColor: st.bg }]}>
          <Ionicons name={st.icon as any} size={32} color={st.color} />
          <View style={{ marginLeft: 12 }}>
            <Text style={[styles.statusLabel, { color: st.color }]}>{st.label}</Text>
            <Text style={styles.statusDate}>
              {order.createdAt ? new Date(order.createdAt).toLocaleString('uk-UA') : ''}
            </Text>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Товари</Text>
          {(order.items || []).map((item: any, idx: number) => (
            <View key={idx} style={styles.itemRow}>
              <View style={styles.itemIcon}>
                <Ionicons name="cube-outline" size={24} color={colors.textTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.size && <Text style={styles.itemMeta}>Розмір: {item.size}</Text>}
                <Text style={styles.itemQty}>× {item.quantity}</Text>
              </View>
              <Text style={styles.itemPrice}>{item.price * item.quantity} ₴</Text>
            </View>
          ))}
        </View>

        {/* Delivery */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Доставка</Text>
          <Text style={styles.deliveryMethod}>{DELIVERY_LABELS[order.deliveryMethod] || order.deliveryMethod}</Text>
          {order.shippingAddress && <Text style={styles.deliveryAddress}>{order.shippingAddress}</Text>}
          {order.phone && <Text style={styles.deliveryPhone}>{order.phone}</Text>}
          {order.comment && <Text style={styles.deliveryComment}>{order.comment}</Text>}
        </View>

        {/* Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Всього</Text>
          <Text style={styles.totalValue}>{order.totalAmount} ₴</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  statusCard: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 16 },
  statusLabel: { fontSize: 18, fontWeight: '700' },
  statusDate: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  section: { marginTop: 20, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#0F0F10' },
  itemMeta: { fontSize: 12, color: colors.textSecondary },
  itemQty: { fontSize: 12, color: colors.textSecondary },
  itemPrice: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  deliveryMethod: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  deliveryAddress: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  deliveryPhone: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  deliveryComment: { fontSize: 13, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
  totalCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  totalLabel: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  totalValue: { fontSize: 28, fontWeight: '800', color: '#E30613' },
});
