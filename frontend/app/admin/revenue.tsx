import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

export default function RevenueBreakdownScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get('/owner/revenue-breakdown');
      setData(res.data);
    } catch (e) {
      console.error('Failed to fetch revenue:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const totalRevenue = data.saas.monthly + data.marketplace.month;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Revenue Breakdown</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}
      >
        {/* Total Revenue Hero */}
        <View style={styles.heroCard} testID="revenue-hero">
          <Text style={styles.heroLabel}>Загальний дохід (місяць)</Text>
          <Text style={styles.heroValue}>{totalRevenue.toLocaleString()} ₴</Text>
          <View style={styles.heroPlan}>
            <Text style={styles.heroPlanText}>Тариф: {data.plan}</Text>
          </View>
        </View>

        {/* Revenue Sources */}
        <Text style={styles.sectionTitle}>Джерела доходу</Text>

        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceIcon, { backgroundColor: '#3B82F6' }]}>
              <Ionicons name="cloud-outline" size={20} color="#FFF" />
            </View>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceName}>SaaS підписка</Text>
              <Text style={styles.sourceSub}>Щомісячна оплата тарифу</Text>
            </View>
            <Text style={styles.sourceAmount}>{data.saas.monthly.toLocaleString()} ₴</Text>
          </View>
        </View>

        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceIcon, { backgroundColor: '#10B981' }]}>
              <Ionicons name="cart-outline" size={20} color="#FFF" />
            </View>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceName}>Marketplace</Text>
              <Text style={styles.sourceSub}>{data.marketplace.ordersMonth} замовлень цього місяця</Text>
            </View>
            <Text style={styles.sourceAmount}>{data.marketplace.month.toLocaleString()} ₴</Text>
          </View>
        </View>

        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceIcon, { backgroundColor: '#F59E0B' }]}>
              <Ionicons name="analytics-outline" size={20} color="#FFF" />
            </View>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceName}>Комісія платформи</Text>
              <Text style={styles.sourceSub}>Від продажів маркетплейсу</Text>
            </View>
            <Text style={styles.sourceAmount}>{data.commission.month.toLocaleString()} ₴</Text>
          </View>
        </View>

        <View style={styles.sourceCard}>
          <View style={styles.sourceRow}>
            <View style={[styles.sourceIcon, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="people-outline" size={20} color="#FFF" />
            </View>
            <View style={styles.sourceInfo}>
              <Text style={styles.sourceName}>Бонуси тренерів</Text>
              <Text style={styles.sourceSub}>{data.coachBonuses.rate}% від рекомендованих продажів</Text>
            </View>
            <Text style={[styles.sourceAmount, { color: '#EF4444' }]}>-{data.coachBonuses.total.toLocaleString()} ₴</Text>
          </View>
        </View>

        {/* TOP Source */}
        {data.topSource && (
          <>
            <Text style={styles.sectionTitle}>ТОП джерело</Text>
            <View style={styles.topSourceCard}>
              <Ionicons name="trophy" size={32} color="#F59E0B" />
              <View style={styles.topSourceInfo}>
                <Text style={styles.topSourceName}>{data.topSource.name}</Text>
                <Text style={styles.topSourcePercent}>{data.topSource.percent}% від усіх продажів</Text>
              </View>
              <Text style={styles.topSourceAmount}>{data.topSource.amount.toLocaleString()} ₴</Text>
            </View>
          </>
        )}

        {/* Sources breakdown */}
        {data.sources.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Розбивка по каналах</Text>
            {data.sources.map((s: any, idx: number) => (
              <View key={idx} style={styles.breakdownRow}>
                <View style={styles.breakdownBar}>
                  <View style={[styles.breakdownFill, { width: `${Math.min(s.percent, 100)}%` }]} />
                </View>
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownName}>{s.name}</Text>
                  <Text style={styles.breakdownPercent}>{s.percent}%</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Action: Activate coaches */}
        <View style={styles.actionCard}>
          <Ionicons name="rocket-outline" size={24} color="#E30613" />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Активуйте тренерів</Text>
            <Text style={styles.actionSub}>Тренери з KPI продають в 3x більше. Увімкніть бонуси!</Text>
          </View>
        </View>

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
  scroll: { flex: 1, paddingHorizontal: 16 },
  heroCard: { backgroundColor: '#1A1A1E', borderRadius: 20, padding: 24, marginTop: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E30613' },
  heroLabel: { fontSize: 14, color: '#9CA3AF' },
  heroValue: { fontSize: 36, fontWeight: '800', color: '#FFF', marginTop: 8 },
  heroPlan: { backgroundColor: '#E30613', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4, marginTop: 12 },
  heroPlanText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 24, marginBottom: 12 },
  sourceCard: { backgroundColor: '#1A1A1E', borderRadius: 14, padding: 16, marginBottom: 8 },
  sourceRow: { flexDirection: 'row', alignItems: 'center' },
  sourceIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sourceInfo: { flex: 1, marginLeft: 12 },
  sourceName: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  sourceSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  sourceAmount: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  topSourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E2A1E', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F59E0B' },
  topSourceInfo: { flex: 1, marginLeft: 14 },
  topSourceName: { fontSize: 16, fontWeight: '700', color: '#F59E0B' },
  topSourcePercent: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  topSourceAmount: { fontSize: 20, fontWeight: '800', color: '#FFF' },
  breakdownRow: { marginBottom: 14 },
  breakdownBar: { height: 8, backgroundColor: '#1A1A1E', borderRadius: 4, overflow: 'hidden' },
  breakdownFill: { height: 8, backgroundColor: '#E30613', borderRadius: 4 },
  breakdownInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  breakdownName: { fontSize: 13, color: '#9CA3AF' },
  breakdownPercent: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  actionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1E', borderRadius: 16, padding: 18, marginTop: 16, borderWidth: 1, borderColor: '#E30613' },
  actionInfo: { flex: 1, marginLeft: 14 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#E30613' },
  actionSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
