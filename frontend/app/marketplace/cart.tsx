import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';
import { useStore } from '../../src/store/useStore';

export default function CartScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setCartItemsCount = useStore((s) => s.setCartItemsCount);

  const { data: cart, isLoading, refetch } = useQuery({
    queryKey: ['cart'],
    queryFn: () => api.get('/shop/cart'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/shop/cart/update', data),
    onSuccess: (d) => { queryClient.invalidateQueries({ queryKey: ['cart'] }); },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/shop/cart/remove/${productId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cart'] }); },
  });

  const clearMutation = useMutation({
    mutationFn: () => api.delete('/shop/cart/clear'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setCartItemsCount(0);
    },
  });

  const items = cart?.items || [];
  const totalAmount = cart?.totalAmount || 0;
  const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);

  React.useEffect(() => {
    setCartItemsCount(itemCount);
  }, [itemCount]);

  if (isLoading) return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Кошик</Text>
        {items.length > 0 && (
          <TouchableOpacity testID="clear-cart" onPress={() => {
            Alert.alert('Очистити кошик?', '', [
              { text: 'Ні', style: 'cancel' },
              { text: 'Так', onPress: () => clearMutation.mutate(), style: 'destructive' },
            ]);
          }}>
            <Text style={styles.clearText}>Очистити</Text>
          </TouchableOpacity>
        )}
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="cart-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Кошик порожній</Text>
          <Text style={styles.emptySubtitle}>Додайте товари з магазину</Text>
          <TouchableOpacity testID="go-shop" style={styles.goShopBtn} onPress={() => router.back()}>
            <Text style={styles.goShopText}>До магазину</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {items.map((item: any, idx: number) => {
              const prod = item.product;
              return (
                <View key={`${item.productId}-${idx}`} style={styles.cartItem}>
                  <View style={styles.itemIcon}>
                    <Ionicons name="cube-outline" size={32} color={colors.textTertiary} />
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{prod?.name || 'Товар'}</Text>
                    {item.size && <Text style={styles.itemMeta}>Розмір: {item.size}</Text>}
                    <Text style={styles.itemPrice}>{item.price} ₴</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity
                        testID={`qty-minus-${idx}`}
                        style={styles.qtyBtn}
                        onPress={() => updateMutation.mutate({ productId: item.productId, quantity: Math.max(0, item.quantity - 1), size: item.size })}
                      >
                        <Ionicons name="remove" size={16} color="#0F0F10" />
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.quantity}</Text>
                      <TouchableOpacity
                        testID={`qty-plus-${idx}`}
                        style={styles.qtyBtn}
                        onPress={() => updateMutation.mutate({ productId: item.productId, quantity: item.quantity + 1, size: item.size })}
                      >
                        <Ionicons name="add" size={16} color="#0F0F10" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity testID={`remove-item-${idx}`} onPress={() => removeMutation.mutate(item.productId)}>
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Bottom */}
          <View style={styles.bottomBar}>
            <View>
              <Text style={styles.bottomLabel}>{itemCount} товар(ів)</Text>
              <Text style={styles.bottomTotal}>{totalAmount} ₴</Text>
            </View>
            <TouchableOpacity
              testID="checkout-button"
              style={styles.checkoutBtn}
              onPress={() => router.push('/marketplace/checkout')}
            >
              <Text style={styles.checkoutText}>Оформити</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  clearText: { fontSize: 14, color: '#EF4444', fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  itemIcon: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1, marginLeft: 12 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0F0F10', lineHeight: 20 },
  itemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 16, fontWeight: '700', color: '#E30613', marginTop: 4 },
  itemActions: { alignItems: 'center', gap: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qtyBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  qtyText: { fontSize: 14, fontWeight: '700', color: '#0F0F10', minWidth: 20, textAlign: 'center' },
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
  bottomLabel: { fontSize: 13, color: colors.textSecondary },
  bottomTotal: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E30613', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  checkoutText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F10', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  goShopBtn: { marginTop: 24, backgroundColor: '#E30613', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
  goShopText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
