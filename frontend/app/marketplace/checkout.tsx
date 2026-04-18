import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';
import { useStore } from '../../src/store/useStore';

const DELIVERY_METHODS = [
  { id: 'CLUB_PICKUP', label: 'Забрати в клубі', icon: 'location', desc: 'Безкоштовно' },
  { id: 'NOVA_POSHTA', label: 'Нова Пошта', icon: 'cube', desc: 'За тарифами НП' },
];

export default function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useStore((s) => s.user);
  const setCartItemsCount = useStore((s) => s.setCartItemsCount);

  const [delivery, setDelivery] = useState('CLUB_PICKUP');
  const [phone, setPhone] = useState(user?.phone || '');
  const [comment, setComment] = useState('');
  const [address, setAddress] = useState('');

  const { data: cart, isLoading } = useQuery({
    queryKey: ['cart'],
    queryFn: () => api.get('/shop/cart'),
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: any) => api.post('/shop/checkout', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setCartItemsCount(0);
      Alert.alert(
        'Замовлення створено!',
        `Замовлення #${res.orderId?.slice(-6)} на суму ${res.totalAmount} ₴`,
        [{ text: 'Мої замовлення', onPress: () => router.replace('/marketplace/orders') }]
      );
    },
    onError: (e: any) => Alert.alert('Помилка', e.response?.data?.message || 'Не вдалося оформити'),
  });

  const items = cart?.items || [];
  const totalAmount = cart?.totalAmount || 0;

  const handleCheckout = () => {
    if (items.length === 0) return;
    checkoutMutation.mutate({
      deliveryMethod: delivery,
      phone,
      comment,
      shippingAddress: delivery === 'NOVA_POSHTA' ? address : undefined,
    });
  };

  if (isLoading) return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Оформлення</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Order Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ваше замовлення</Text>
            {items.map((item: any, idx: number) => (
              <View key={idx} style={styles.summaryItem}>
                <View style={styles.summaryLeft}>
                  <Text style={styles.summaryName} numberOfLines={1}>{item.product?.name || 'Товар'}</Text>
                  <Text style={styles.summaryQty}>× {item.quantity}</Text>
                </View>
                <Text style={styles.summaryPrice}>{(item.price || 0) * (item.quantity || 0)} ₴</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Всього</Text>
              <Text style={styles.totalValue}>{totalAmount} ₴</Text>
            </View>
          </View>

          {/* Delivery */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Спосіб отримання</Text>
            {DELIVERY_METHODS.map((m) => (
              <TouchableOpacity
                key={m.id}
                testID={`delivery-${m.id}`}
                style={[styles.deliveryOption, delivery === m.id && styles.deliveryOptionActive]}
                onPress={() => setDelivery(m.id)}
              >
                <Ionicons name={m.icon as any} size={24} color={delivery === m.id ? '#E30613' : '#6B7280'} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.deliveryLabel, delivery === m.id && styles.deliveryLabelActive]}>{m.label}</Text>
                  <Text style={styles.deliveryDesc}>{m.desc}</Text>
                </View>
                <Ionicons name={delivery === m.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={delivery === m.id ? '#E30613' : '#D1D5DB'} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Nova Poshta Address */}
          {delivery === 'NOVA_POSHTA' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Адреса доставки</Text>
              <TextInput
                testID="address-input"
                style={styles.input}
                placeholder="Місто, відділення Нової Пошти"
                placeholderTextColor="#9CA3AF"
                value={address}
                onChangeText={setAddress}
              />
            </View>
          )}

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Контакти</Text>
            <TextInput
              testID="phone-input"
              style={styles.input}
              placeholder="Телефон"
              placeholderTextColor="#9CA3AF"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <TextInput
              testID="comment-input"
              style={[styles.input, { marginTop: 12, height: 80, textAlignVertical: 'top' }]}
              placeholder="Коментар до замовлення (необов'язково)"
              placeholderTextColor="#9CA3AF"
              value={comment}
              onChangeText={setComment}
              multiline
            />
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>До оплати</Text>
          <Text style={styles.bottomTotal}>{totalAmount} ₴</Text>
        </View>
        <TouchableOpacity
          testID="confirm-order-button"
          style={[styles.confirmBtn, (items.length === 0 || checkoutMutation.isPending) && styles.confirmBtnDisabled]}
          onPress={handleCheckout}
          disabled={items.length === 0 || checkoutMutation.isPending}
        >
          {checkoutMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmText}>Підтвердити</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0F0F10', marginBottom: 12 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryName: { fontSize: 14, color: '#374151', flex: 1 },
  summaryQty: { fontSize: 13, color: colors.textSecondary },
  summaryPrice: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: 2, borderTopColor: '#E5E7EB' },
  totalLabel: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  totalValue: { fontSize: 22, fontWeight: '800', color: '#E30613' },
  deliveryOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#E5E7EB', marginBottom: 10 },
  deliveryOptionActive: { borderColor: '#E30613', backgroundColor: '#FEF2F2' },
  deliveryLabel: { fontSize: 15, fontWeight: '600', color: '#374151' },
  deliveryLabelActive: { color: '#E30613' },
  deliveryDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0F0F10' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
  bottomLabel: { fontSize: 13, color: colors.textSecondary },
  bottomTotal: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  confirmBtn: { backgroundColor: '#E30613', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  confirmBtnDisabled: { backgroundColor: '#FECACA' },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
