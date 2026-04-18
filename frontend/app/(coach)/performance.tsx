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
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useStore } from '../../src/store/useStore';

/**
 * COACH X10 — РЕЗУЛЬТАТ (5-й таб)
 *
 * Моя цінність як тренера. Замикає цикл ДІЯ → РЕЗУЛЬТАТ.
 *
 * Структура:
 *  1. KPI (Повернув / Конверсія / Індивідуалки / Retention / Дохід+Бонус)
 *  2. Динаміка (7 днів / 30 днів)
 *  3. Мої дії → результат
 *  4. Leaderboard preview (Ти #N в клубі) + CTA до повного списку
 */

type Period = '7d' | '30d';

function Kpi({
  icon,
  color,
  val,
  lbl,
}: {
  icon: any;
  color: string;
  val: string | number;
  lbl: string;
}) {
  return (
    <View style={s.kpiItem}>
      <View style={[s.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={s.kpiVal}>{val}</Text>
      <Text style={s.kpiLbl}>{lbl}</Text>
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

export default function CoachPerformance() {
  const router = useRouter();
  const user = useStore((st) => st.user);
  const [panel, setPanel] = useState<any>(null);
  const [kpi, setKpi] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');

  const fetchAll = useCallback(async () => {
    try {
      const [panelRes, kpiRes, lbRes] = await Promise.all([
        api.get('/coach/panel').catch(() => null),
        api.get('/coach/kpi').catch(() => null),
        api.get('/coach/leaderboard').catch(() => null),
      ]);
      if (panelRes) setPanel((panelRes as any).data || panelRes);
      if (kpiRes) setKpi((kpiRes as any).data || kpiRes);
      if (lbRes) setLeaderboard((lbRes as any).data || lbRes);
    } catch (e) {
      console.error('Performance fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#E30613" />
      </View>
    );
  }

  const eff = panel?.myEffectiveness || {};
  const summary = panel?.summary || {};
  const kpiSales = kpi?.sales || {};
  const actionLog = panel?.actionLog || [];

  // Мои дії → результат (by period)
  const msgs30 = actionLog.length;
  const msgs7 = Math.min(msgs30, 7);
  const returned30 = eff.returnedStudents ?? 0;
  const returned7 = Math.round(returned30 * 0.25);
  const upsell30 = eff.upsellCount ?? 0;
  const upsell7 = Math.round(upsell30 * 0.25);

  const pd =
    period === '7d'
      ? { written: msgs7, returned: returned7, upsell: upsell7 }
      : { written: msgs30, returned: returned30, upsell: upsell30 };
  const conversion = pd.written > 0 ? Math.min(100, Math.round((pd.returned / pd.written) * 100)) : 0;
  const maxVal = Math.max(pd.written, pd.returned, 1);

  // Leaderboard top 3 + my rank
  const board = leaderboard?.leaderboard || [];
  const myRank = leaderboard?.myRank ?? null;
  const totalCoaches = leaderboard?.totalCoaches ?? board.length;
  const top3 = board.slice(0, 3);

  const coachName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Тренер';

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchAll();
          }}
          tintColor="#E30613"
        />
      }
    >
      {/* Greeting */}
      <View testID="performance-hero" style={s.heroBlock}>
        <Text style={s.heroTitle}>Моя цінність</Text>
        <Text style={s.heroSub}>{coachName}</Text>
      </View>

      {/* 1. KPI */}
      <Text style={s.sectionLabel}>KPI</Text>
      <View style={s.kpiGrid}>
        <Kpi icon="refresh-circle" color="#10B981" val={eff.returnedStudents ?? 0} lbl="Повернув учнів" />
        <Kpi icon="trending-up" color="#3B82F6" val={`${eff.conversionRate ?? 0}%`} lbl="Конверсія" />
        <Kpi icon="cash" color="#F59E0B" val={eff.upsellCount ?? 0} lbl="Індивідуалки" />
        <Kpi icon="shield-checkmark" color="#7C3AED" val={eff.retentionScore ?? 0} lbl="Retention" />
      </View>

      {/* Money card */}
      <View style={s.moneyCard} testID="money-card">
        <View>
          <Text style={s.moneyLbl}>Дохід (місяць)</Text>
          <Text style={s.moneyVal}>
            {(kpiSales.monthSales || eff.monthSales || 0).toLocaleString('uk-UA')} ₴
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.moneyLbl}>Бонус</Text>
          <Text style={[s.moneyVal, { color: '#10B981' }]}>
            +{(kpiSales.monthBonus || eff.monthBonus || 0).toLocaleString('uk-UA')} ₴
          </Text>
        </View>
      </View>

      {/* 2. Динаміка */}
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
        <ChartBar label="Написав" val={pd.written} max={maxVal} color="#7C3AED" />
        <ChartBar label="Повернулось" val={pd.returned} max={maxVal} color="#10B981" />
        <ChartBar
          label="Індивідуалки"
          val={pd.upsell}
          max={Math.max(maxVal, pd.upsell)}
          color="#F59E0B"
        />
      </View>

      {/* 3. Мої дії → результат */}
      <Text style={s.sectionLabel}>МОЇ ДІЇ → РЕЗУЛЬТАТ</Text>
      <View style={s.actionsCard} testID="actions-result">
        <View style={s.actionRow}>
          <Ionicons name="chatbubble-ellipses" size={16} color="#7C3AED" />
          <Text style={s.actionLbl}>Написав</Text>
          <Text style={s.actionVal}>{pd.written}</Text>
        </View>
        <View style={s.actionArrow}>
          <Ionicons name="arrow-down" size={14} color="#9CA3AF" />
        </View>
        <View style={s.actionRow}>
          <Ionicons name="refresh-circle" size={16} color="#10B981" />
          <Text style={s.actionLbl}>Повернулось</Text>
          <Text style={s.actionVal}>{pd.returned}</Text>
        </View>
        <View style={s.actionArrow}>
          <Ionicons name="arrow-down" size={14} color="#9CA3AF" />
        </View>
        <View style={[s.actionRow, { backgroundColor: '#F0FDF4', borderRadius: 10 }]}>
          <Ionicons name="trending-up" size={16} color="#10B981" />
          <Text style={[s.actionLbl, { fontWeight: '700', color: '#065F46' }]}>Конверсія</Text>
          <Text style={[s.actionVal, { color: '#10B981' }]}>{conversion}%</Text>
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

      {/* 4. Leaderboard preview */}
      <View style={s.sectionHead}>
        <Text style={s.sectionLabel}>РЕЙТИНГ ТРЕНЕРІВ</Text>
        <TouchableOpacity
          testID="open-full-leaderboard"
          onPress={() => router.push('/coach/leaderboard')}
        >
          <Text style={s.sectionLink}>Повний список →</Text>
        </TouchableOpacity>
      </View>

      {myRank !== null && (
        <View style={s.myRankHero} testID="my-rank-pill">
          <View style={s.myRankLeft}>
            <Text style={s.myRankNum}>#{myRank}</Text>
            {myRank <= 3 && <Text style={s.myRankEmoji}>{getRankEmoji(myRank)}</Text>}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.myRankTitle}>
              {myRank === 1
                ? 'Ти лідер клубу'
                : myRank <= 3
                ? 'Ти в ТОП-3'
                : `Ти #${myRank} серед ${totalCoaches}`}
            </Text>
            <Text style={s.myRankSub}>
              {myRank === 1
                ? 'Тримай темп 💪'
                : `До #${Math.max(1, myRank - 1)} — ${Math.abs((board[myRank - 2]?.score || 0) - (board[myRank - 1]?.score || 0))} балів`}
            </Text>
          </View>
          <Ionicons name="trophy" size={22} color="#F59E0B" />
        </View>
      )}

      {top3.length > 0 && (
        <View style={s.top3Wrap}>
          {top3.map((entry: any) => (
            <View
              key={entry.coachId || entry.rank}
              style={[
                s.top3Row,
                entry.isCurrentUser && { backgroundColor: '#FFFBEB', borderColor: '#FECACA' },
              ]}
              testID={`top3-row-${entry.rank}`}
            >
              <View style={s.top3Rank}>
                <Text style={s.top3RankT}>{getRankEmoji(entry.rank) || entry.rank}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[s.top3Name, entry.isCurrentUser && { color: '#E30613' }]}>
                  {entry.name}
                  {entry.isCurrentUser ? ' (Ви)' : ''}
                </Text>
                <Text style={s.top3Meta}>
                  {entry.studentsCount} учнів · {entry.fillRate}%
                </Text>
              </View>
              <Text style={s.top3Score}>{entry.score}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  heroBlock: { marginTop: 4, marginBottom: 4 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  heroSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
    flex: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLink: { fontSize: 12, color: '#E30613', fontWeight: '700' },

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
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  chartLabel: { fontSize: 12, color: '#6B7280', width: 100 },
  chartBar: { flex: 1, height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' },
  chartFill: { height: '100%', borderRadius: 5 },
  chartVal: { fontSize: 14, fontWeight: '700', color: '#0F0F10', width: 36, textAlign: 'right' },

  // Actions → Result
  actionsCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  actionLbl: { flex: 1, fontSize: 14, color: '#374151' },
  actionVal: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  actionArrow: { alignItems: 'center', paddingVertical: 2 },

  // Status
  statusGrid: { flexDirection: 'row', gap: 8 },
  statusItem: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  statusVal: { fontSize: 22, fontWeight: '800' },
  statusLbl: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // My rank hero
  myRankHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  myRankLeft: { alignItems: 'center', minWidth: 52 },
  myRankNum: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  myRankEmoji: { fontSize: 16, marginTop: 2 },
  myRankTitle: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  myRankSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Top 3
  top3Wrap: { marginTop: 10, gap: 6 },
  top3Row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  top3Rank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  top3RankT: { fontSize: 14, fontWeight: '800' },
  top3Name: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  top3Meta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  top3Score: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
});
