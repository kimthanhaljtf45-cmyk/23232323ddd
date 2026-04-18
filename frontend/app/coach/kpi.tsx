import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

/**
 * COACH ANALYTICS — светлая тема, платформенный паттерн
 * Блоки:
 *  A. KPI (4 показника)
 *  B. Динаміка (7d / 30d)
 *  C. Мої дії → результат
 *  D. Ссылка на Leaderboard
 */

type Period = '7d' | '30d';

function Kpi({
  icon,
  color,
  val,
  lbl,
  trend,
}: {
  icon: any;
  color: string;
  val: string | number;
  lbl: string;
  trend?: string;
}) {
  return (
    <View style={s.kpiItem}>
      <View style={[s.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={s.kpiVal}>{val}</Text>
      <Text style={s.kpiLbl}>{lbl}</Text>
      {trend && <Text style={[s.kpiTrend, { color }]}>{trend}</Text>}
    </View>
  );
}

function ChartBar({ label, val, max, color }: { label: string; val: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(4, (val / max) * 100) : 0;
  return (
    <View style={s.chartRow}>
      <Text style={s.chartLabel}>{label}</Text>
      <View style={s.chartBar}>
        <View style={[s.chartFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.chartVal}>{val}</Text>
    </View>
  );
}

export default function CoachAnalyticsScreen() {
  const router = useRouter();
  const [panel, setPanel] = useState<any>(null);
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchData = useCallback(async () => {
    try {
      const [panelRes, kpiRes] = await Promise.all([
        api.get('/coach/panel'),
        api.get('/coach/kpi'),
      ]);
      setPanel(panelRes.data || panelRes);
      setKpi(kpiRes.data || kpiRes);
    } catch (e) {
      console.error('Analytics fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={s.loadContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const eff = panel?.myEffectiveness || {};
  const summary = panel?.summary || {};
  const kpiSales = kpi?.sales || {};

  // Динамика: 7 vs 30 днів. Приклад підрахунку з доступних даних.
  const actionLog = panel?.actionLog || [];
  const msgs7 = Math.min(actionLog.length, 7);
  const msgs30 = actionLog.length;
  const returned30 = eff.returnedStudents ?? 0;
  const returned7 = Math.round(returned30 * 0.25);
  const upsell30 = eff.upsellCount ?? 0;
  const upsell7 = Math.round(upsell30 * 0.25);

  const periodData = period === '7d'
    ? { written: msgs7, returned: returned7, upsell: upsell7, sales: Math.round((kpiSales.monthSales || 0) * 0.25) }
    : { written: msgs30, returned: returned30, upsell: upsell30, sales: kpiSales.monthSales || 0 };

  const conversion = periodData.written > 0
    ? Math.min(100, Math.round((periodData.returned / periodData.written) * 100))
    : 0;

  const maxVal = Math.max(periodData.written, periodData.returned, 1);

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Моя ефективність</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor="#E30613"
          />
        }
      >
        {/* A. KPI */}
        <Text style={s.sectionLabel}>KPI</Text>
        <View style={s.kpiGrid}>
          <Kpi
            icon="refresh-circle"
            color="#10B981"
            val={eff.returnedStudents ?? 0}
            lbl="Повернув учнів"
          />
          <Kpi
            icon="trending-up"
            color="#3B82F6"
            val={`${eff.conversionRate ?? 0}%`}
            lbl="Конверсія"
          />
          <Kpi
            icon="cash"
            color="#F59E0B"
            val={eff.upsellCount ?? 0}
            lbl="Індивідуалки"
          />
          <Kpi
            icon="shield-checkmark"
            color="#7C3AED"
            val={eff.retentionScore ?? 0}
            lbl="Retention"
          />
        </View>

        {/* Дохід + бонус */}
        <View style={s.moneyCard} testID="money-card">
          <View>
            <Text style={s.moneyLbl}>Дохід (місяць)</Text>
            <Text style={s.moneyVal}>{(kpiSales.monthSales || eff.monthSales || 0).toLocaleString('uk-UA')} ₴</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.moneyLbl}>Бонус</Text>
            <Text style={[s.moneyVal, { color: '#10B981' }]}>
              +{(kpiSales.monthBonus || eff.monthBonus || 0).toLocaleString('uk-UA')} ₴
            </Text>
          </View>
        </View>

        {/* B. Динаміка */}
        <View style={s.sectionHead}>
          <Text style={s.sectionLabel}>ДИНАМІКА</Text>
          <View style={s.periodTabs}>
            <TouchableOpacity
              testID="period-7d"
              style={[s.periodTab, period === '7d' && s.periodTabActive]}
              onPress={() => setPeriod('7d')}
            >
              <Text style={[s.periodTabT, period === '7d' && s.periodTabTActive]}>7 днів</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="period-30d"
              style={[s.periodTab, period === '30d' && s.periodTabActive]}
              onPress={() => setPeriod('30d')}
            >
              <Text style={[s.periodTabT, period === '30d' && s.periodTabTActive]}>30 днів</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.chartCard} testID="dynamics-chart">
          <ChartBar label="Написав" val={periodData.written} max={maxVal} color="#7C3AED" />
          <ChartBar label="Повернулось" val={periodData.returned} max={maxVal} color="#10B981" />
          <ChartBar label="Індивідуалки" val={periodData.upsell} max={Math.max(maxVal, periodData.upsell)} color="#F59E0B" />
        </View>

        {/* C. Мої дії → результат */}
        <Text style={s.sectionLabel}>МОЇ ДІЇ → РЕЗУЛЬТАТ</Text>
        <View style={s.actionsCard} testID="actions-result">
          <View style={s.actionRow}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#7C3AED" />
            <Text style={s.actionLbl}>Написав</Text>
            <Text style={s.actionVal}>{periodData.written}</Text>
          </View>
          <View style={s.actionRow}>
            <Ionicons name="refresh-circle" size={16} color="#10B981" />
            <Text style={s.actionLbl}>Повернулось</Text>
            <Text style={s.actionVal}>{periodData.returned}</Text>
          </View>
          <View style={s.actionRow}>
            <Ionicons name="trending-up" size={16} color="#3B82F6" />
            <Text style={s.actionLbl}>Конверсія</Text>
            <Text style={[s.actionVal, { color: '#3B82F6' }]}>{conversion}%</Text>
          </View>
          <View style={s.actionRow}>
            <Ionicons name="cash" size={16} color="#F59E0B" />
            <Text style={s.actionLbl}>Упсели</Text>
            <Text style={s.actionVal}>{periodData.upsell}</Text>
          </View>
        </View>

        {/* Students by status */}
        <Text style={s.sectionLabel}>УЧНІ ЗА СТАТУСОМ</Text>
        <View style={s.statusGrid}>
          <View style={[s.statusItem, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[s.statusVal, { color: '#EF4444' }]}>{summary.risk || 0}</Text>
            <Text style={s.statusLbl}>Ризик</Text>
          </View>
          <View style={[s.statusItem, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.statusVal, { color: '#10B981' }]}>{summary.rising || 0}</Text>
            <Text style={s.statusLbl}>Росте</Text>
          </View>
          <View style={[s.statusItem, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[s.statusVal, { color: '#3B82F6' }]}>{summary.stable || 0}</Text>
            <Text style={s.statusLbl}>Стабільні</Text>
          </View>
        </View>

        {/* D. Leaderboard CTA */}
        <TouchableOpacity
          testID="open-leaderboard-from-kpi"
          style={s.leaderboardCta}
          onPress={() => router.push('/coach/leaderboard')}
        >
          <View style={s.leaderboardIcon}>
            <Ionicons name="trophy" size={20} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.leaderboardTitle}>Leaderboard тренерів</Text>
            <Text style={s.leaderboardSub}>Де я зараз серед колег</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  loadContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F0F10' },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  kpiVal: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  kpiLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  kpiTrend: { fontSize: 11, fontWeight: '700', marginTop: 4 },

  // Money card
  moneyCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  moneyLbl: { fontSize: 12, color: '#6B7280' },
  moneyVal: { fontSize: 20, fontWeight: '800', color: '#0F0F10', marginTop: 4 },

  // Period
  periodTabs: { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 10, padding: 2 },
  periodTab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  periodTabActive: { backgroundColor: '#FFF' },
  periodTabT: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  periodTabTActive: { color: '#0F0F10' },

  // Chart
  chartCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  chartLabel: { fontSize: 12, color: '#6B7280', width: 100 },
  chartBar: {
    flex: 1,
    height: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 5,
    overflow: 'hidden',
  },
  chartFill: { height: '100%', borderRadius: 5 },
  chartVal: { fontSize: 14, fontWeight: '700', color: '#0F0F10', width: 36, textAlign: 'right' },

  // Actions → Result
  actionsCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  actionLbl: { flex: 1, fontSize: 14, color: '#374151' },
  actionVal: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },

  // Status
  statusGrid: { flexDirection: 'row', gap: 8 },
  statusItem: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  statusVal: { fontSize: 22, fontWeight: '800' },
  statusLbl: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Leaderboard CTA
  leaderboardCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  leaderboardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaderboardTitle: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  leaderboardSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
