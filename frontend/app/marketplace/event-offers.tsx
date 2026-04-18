import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

const EVENT_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  belt_upgrade: { icon: 'ribbon-outline', color: '#F59E0B' },
  low_attendance: { icon: 'alert-circle-outline', color: '#EF4444' },
  new_student: { icon: 'sparkles-outline', color: '#10B981' },
  high_attendance: { icon: 'flame-outline', color: '#F97316' },
  competition_win: { icon: 'trophy-outline', color: '#F59E0B' },
  birthday: { icon: 'gift-outline', color: '#EC4899' },
};

export default function EventOffersScreen() {
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = async () => {
    try {
      const res = await api.get('/events/parent-feed');
      setFeed(res.data.feed || []);
    } catch (e) {
      console.error('Failed to fetch event feed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchFeed(); }, []);

  const handleBuy = async (productId: string, discount: number) => {
    try {
      await api.post('/marketplace/quick-checkout', {
        productId,
        discount,
        source: 'event_offer',
        quantity: 1,
      });
      // Navigate to success or refresh
      fetchFeed();
    } catch (e) {
      console.error('Quick buy failed:', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Пропозиції</Text>
        {feed.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{feed.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchFeed(); }} tintColor="#E30613" />}
      >
        {feed.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={56} color="#4B5563" />
            <Text style={styles.emptyTitle}>Поки немає пропозицій</Text>
            <Text style={styles.emptySub}>Пропозиції з'являться після подій ваших дітей</Text>
          </View>
        ) : (
          feed.map((item, idx) => {
            const eventConfig = EVENT_ICONS[item.eventType] || { icon: 'star-outline', color: '#9CA3AF' };
            return (
              <View key={idx} style={styles.offerCard} testID={`event-offer-${idx}`}>
                <View style={styles.offerHeader}>
                  <View style={[styles.eventIcon, { backgroundColor: eventConfig.color + '20' }]}>
                    <Ionicons name={eventConfig.icon} size={24} color={eventConfig.color} />
                  </View>
                  <View style={styles.offerInfo}>
                    <Text style={styles.offerChild}>{item.childName}</Text>
                    <Text style={styles.offerMessage}>{item.message}</Text>
                  </View>
                  {item.discount > 0 && (
                    <View style={styles.discountBadge}>
                      <Text style={styles.discountText}>-{item.discount}%</Text>
                    </View>
                  )}
                </View>

                {item.products && item.products.length > 0 && (
                  <View style={styles.productsRow}>
                    <Text style={styles.productsLabel}>Рекомендуємо:</Text>
                    {item.products.map((p: any, pidx: number) => (
                      <View key={pidx} style={styles.productItem}>
                        <View style={styles.productInfo}>
                          <Text style={styles.productName}>{p.name}</Text>
                          <View style={styles.priceRow}>
                            {item.discount > 0 && (
                              <Text style={styles.oldPrice}>{p.price} ₴</Text>
                            )}
                            <Text style={styles.productPrice}>
                              {item.discount > 0 ? p.discountPrice : p.price} ₴
                            </Text>
                          </View>
                        </View>
                        <TouchableOpacity
                          testID={`buy-product-${pidx}`}
                          style={styles.buyBtn}
                          onPress={() => handleBuy(p.id, item.discount)}
                        >
                          <Text style={styles.buyBtnText}>Купити</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F10' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F1F23' },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFF', marginLeft: 12 },
  badge: { backgroundColor: '#E30613', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  badgeText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginTop: 16 },
  emptySub: { fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' },
  offerCard: { backgroundColor: '#1A1A1E', borderRadius: 18, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#2A2A30' },
  offerHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  eventIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  offerInfo: { flex: 1, marginLeft: 12 },
  offerChild: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  offerMessage: { fontSize: 14, color: '#D1D5DB', marginTop: 4, lineHeight: 20 },
  discountBadge: { backgroundColor: '#E30613', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  discountText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  productsRow: { marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A30' },
  productsLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 10 },
  productItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1F1F23' },
  productInfo: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  oldPrice: { fontSize: 13, color: '#6B7280', textDecorationLine: 'line-through' },
  productPrice: { fontSize: 16, fontWeight: '700', color: '#E30613' },
  buyBtn: { backgroundColor: '#E30613', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  buyBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
