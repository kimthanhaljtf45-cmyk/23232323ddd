import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

const BUNDLE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; gradient: string }> = {
  starter_kit: { icon: 'star-outline', gradient: '#3B82F6' },
  protection_set: { icon: 'shield-checkmark', gradient: '#10B981' },
  premium_all: { icon: 'diamond', gradient: '#E30613' },
};

export default function BundlesScreen() {
  const router = useRouter();
  const [bundles, setBundles] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);

  const fetchBundles = async () => {
    try {
      const [bRes, rRes] = await Promise.allSettled([
        api.get('/marketplace/bundles'),
        api.get('/marketplace/auto-recommend'),
      ]);
      if (bRes.status === 'fulfilled') setBundles(bRes.value.data?.bundles || []);
      if (rRes.status === 'fulfilled') setRecs((rRes.value.data || rRes.value)?.recommendations || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchBundles(); }, []);

  const handleBuy = async (bundle: any) => {
    setBuying(bundle.id);
    try {
      const res = await api.post(`/marketplace/bundles/${bundle.id}/buy`, {});
      Alert.alert('Замовлення створено!', `${bundle.name}\nВигода: ${bundle.originalPrice - bundle.bundlePrice} ₴`);
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося створити замовлення');
    } finally { setBuying(null); }
  };

  if (loading) return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View></SafeAreaView>;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Комплекти</Text>
        <View style={s.headerBadge}><Text style={s.headerBadgeText}>{bundles.length}</Text></View>
      </View>

      <ScrollView style={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBundles(); }} tintColor="#E30613" />}>
        {/* Auto-recommendations for user's children */}
        {recs.length > 0 && (
          <>
            <Text style={s.recSectionTitle}>Рекомендовано для вас</Text>
            {recs.map((rec, i) => {
              const bundle = rec.bundle || {};
              const saved = (bundle.originalPrice || 0) - (bundle.bundlePrice || 0);
              return (
                <View key={i} style={s.recCard} testID={`rec-${rec.type}-${i}`}>
                  <View style={s.recHeader}>
                    <View style={s.recAvatar}><Ionicons name="person" size={18} color="#E30613" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.recTitle}>{rec.title}</Text>
                      <Text style={s.recMessage}>{rec.message}</Text>
                    </View>
                  </View>
                  {bundle.name && (
                    <View style={s.recBundle}>
                      <View style={s.recBundleInfo}>
                        <Text style={s.recBundleName}>{bundle.name}</Text>
                        <Text style={s.recBundleItems}>{bundle.products?.length || 0} товарів · Вигода {saved} ₴</Text>
                      </View>
                      <View>
                        <Text style={s.recOldPrice}>{(bundle.originalPrice || 0).toLocaleString()} ₴</Text>
                        <Text style={s.recNewPrice}>{(bundle.bundlePrice || 0).toLocaleString()} ₴</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        <Text style={s.subtitle}>Вигідніше, ніж по одному</Text>

        {bundles.map((bundle, idx) => {
          const cfg = BUNDLE_ICONS[bundle.id] || { icon: 'cube' as any, gradient: '#6B7280' };
          const saved = bundle.originalPrice - bundle.bundlePrice;
          const isBuying = buying === bundle.id;
          const isPremium = bundle.discountPercent >= 25;

          return (
            <View key={idx} style={[s.card, isPremium && s.cardPremium]} testID={`bundle-${bundle.id}`}>
              {/* Discount Badge */}
              <View style={[s.discountBadge, { backgroundColor: cfg.gradient }]}>
                <Text style={s.discountText}>-{bundle.discountPercent}%</Text>
              </View>

              {/* Header */}
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: cfg.gradient + '18' }]}>
                  <Ionicons name={cfg.icon} size={28} color={cfg.gradient} />
                </View>
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{bundle.name}</Text>
                  <Text style={s.cardDesc}>{bundle.description}</Text>
                </View>
              </View>

              {/* Products List */}
              <View style={s.productsList}>
                {(bundle.products || []).map((p: any, pidx: number) => (
                  <View key={pidx} style={s.productRow}>
                    <View style={s.checkIcon}><Ionicons name="checkmark" size={14} color="#10B981" /></View>
                    <Text style={s.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={s.productPrice}>{p.price} ₴</Text>
                  </View>
                ))}
              </View>

              {/* Footer — pricing + buy */}
              <View style={s.cardFooter}>
                <View>
                  <Text style={s.oldPrice}>{bundle.originalPrice.toLocaleString()} ₴</Text>
                  <View style={s.priceRow}>
                    <Text style={s.newPrice}>{bundle.bundlePrice.toLocaleString()} ₴</Text>
                    <View style={s.savedBadge}>
                      <Text style={s.savedText}>Вигода {saved.toLocaleString()} ₴</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity testID={`buy-bundle-${bundle.id}`} style={[s.buyBtn, { backgroundColor: cfg.gradient }]} onPress={() => handleBuy(bundle)} disabled={isBuying}>
                  {isBuying ? <ActivityIndicator color="#FFF" size="small" /> : (
                    <>
                      <Ionicons name="cart" size={18} color="#FFF" />
                      <Text style={s.buyText}>Купити</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* Info block */}
        <View style={s.infoBlock}>
          <Ionicons name="information-circle" size={20} color="#6B7280" />
          <Text style={s.infoText}>Комплекти формуються автоматично на основі вашого виду спорту. Знижка вже включена в ціну.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F10' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F1F23' },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: '#FFF', marginLeft: 12 },
  headerBadge: { backgroundColor: '#E30613', borderRadius: 10, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  headerBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  subtitle: { fontSize: 14, color: '#9CA3AF', marginTop: 16, marginBottom: 20 },
  card: { backgroundColor: '#1A1A1E', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#2A2A30', overflow: 'hidden' },
  cardPremium: { borderColor: '#E30613', borderWidth: 2 },
  discountBadge: { position: 'absolute', top: 16, right: 16, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, zIndex: 1 },
  discountText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  iconBox: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flex: 1, marginLeft: 14, paddingRight: 50 },
  cardName: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  cardDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  productsList: { paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A30' },
  productRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  checkIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B98118', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  productName: { flex: 1, fontSize: 14, color: '#E5E7EB' },
  productPrice: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A30' },
  oldPrice: { fontSize: 14, color: '#6B7280', textDecorationLine: 'line-through' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  newPrice: { fontSize: 24, fontWeight: '800', color: '#FFF' },
  savedBadge: { backgroundColor: '#10B98118', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  savedText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  buyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 14 },
  buyText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  infoBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, backgroundColor: '#1A1A1E', borderRadius: 14, marginTop: 8 },
  infoText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 18 },
  recSectionTitle: { fontSize: 16, fontWeight: '800', color: '#E30613', marginTop: 16, marginBottom: 12 },
  recCard: { backgroundColor: '#1A1A1E', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E3061333' },
  recHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  recAvatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#E3061318', alignItems: 'center', justifyContent: 'center' },
  recTitle: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  recMessage: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  recBundle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2A2A30' },
  recBundleInfo: { flex: 1 },
  recBundleName: { fontSize: 14, fontWeight: '600', color: '#E5E7EB' },
  recBundleItems: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  recOldPrice: { fontSize: 12, color: '#6B7280', textDecorationLine: 'line-through', textAlign: 'right' },
  recNewPrice: { fontSize: 18, fontWeight: '800', color: '#10B981', textAlign: 'right' },
});
