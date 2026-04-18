import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

export default function OwnerMarketplace() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [commRes, bundleRes] = await Promise.all([
        api.get('/marketplace/commissions'),
        api.get('/marketplace/bundles'),
      ]);
      setData(commRes.data);
      setBundles(bundleRes.data?.bundles || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}>
      <View style={styles.heroCard} testID="marketplace-hero">
        <Text style={styles.heroLabel}>Продажі маркетплейсу</Text>
        <Text style={styles.heroValue}>{(data?.monthCommission || 0).toLocaleString()} ₴</Text>
        <Text style={styles.heroSub}>{data?.monthOrders || 0} замовлень цього місяця</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{(data?.totalCommission || 0).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Комісія (всього)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{data?.totalOrders || 0}</Text>
          <Text style={styles.statLabel}>Замовлень (всього)</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Комплекти</Text>
      {bundles.length === 0 ? (
        <View style={styles.emptyCard}><Ionicons name="cube-outline" size={32} color="#9CA3AF" /><Text style={styles.emptyText}>Немає комплектів</Text></View>
      ) : bundles.map((b: any, i: number) => (
        <View key={i} style={styles.bundleCard}>
          <Text style={styles.bundleName}>{b.name}</Text>
          <View style={styles.bundlePriceRow}>
            <Text style={styles.bundleOld}>{b.originalPrice} ₴</Text>
            <Text style={styles.bundlePrice}>{b.bundlePrice} ₴</Text>
            <View style={styles.discBadge}><Text style={styles.discText}>-{b.discountPercent}%</Text></View>
          </View>
        </View>
      ))}

      <TouchableOpacity testID="go-bundles" style={styles.linkBtn} onPress={() => router.push('/marketplace/bundles' as any)}>
        <Text style={styles.linkText}>Управління комплектами</Text>
        <Ionicons name="arrow-forward" size={18} color="#E30613" />
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  heroCard: { backgroundColor: '#0F0F10', borderRadius: 20, padding: 24, marginTop: 12, alignItems: 'center' },
  heroLabel: { fontSize: 14, color: '#9CA3AF' },
  heroValue: { fontSize: 32, fontWeight: '800', color: '#FFF', marginTop: 8 },
  heroSub: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  statCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F0F10', marginTop: 28, marginBottom: 14, letterSpacing: 0.3 },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 8 },
  bundleCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  bundleName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  bundlePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  bundleOld: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through' },
  bundlePrice: { fontSize: 18, fontWeight: '700', color: '#E30613' },
  discBadge: { backgroundColor: '#10B981', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  discText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  linkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#E30613' },
  linkText: { fontSize: 15, fontWeight: '600', color: '#E30613' },
});
