import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

export default function OwnerFinance() {
  const [data, setData] = useState<any>(null);
  const [cashflow, setCashflow] = useState<any>(null);
  const [debtors, setDebtors] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [revRes, cfRes, debtRes, invRes] = await Promise.allSettled([
        api.get('/owner/revenue-breakdown'),
        api.get('/owner/cashflow'),
        api.get('/owner/debtors'),
        api.get('/owner/invoices'),
      ]);
      if (revRes.status === 'fulfilled') setData(revRes.value.data || revRes.value);
      if (cfRes.status === 'fulfilled') setCashflow(cfRes.value.data || cfRes.value);
      if (debtRes.status === 'fulfilled') setDebtors(debtRes.value.data || debtRes.value);
      if (invRes.status === 'fulfilled') setInvoices((invRes.value.data || invRes.value)?.invoices || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const totalIncome = (data?.saas?.monthly || 0) + (data?.marketplace?.month || 0);

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}>
      {/* Hero */}
      <View style={s.heroCard} testID="finance-hero">
        <Text style={s.heroLabel}>Дохід платформи (місяць)</Text>
        <Text style={s.heroValue}>{totalIncome.toLocaleString()} ₴</Text>
      </View>

      {/* Cashflow */}
      {cashflow && (
        <>
          <Text style={s.sectionTitle}>Cashflow</Text>
          <View style={s.cashflowCard}>
            <View style={s.cashflowRow}>
              <CashflowItem label="Сьогодні" value={cashflow.today || 0} color="#10B981" sub={`${cashflow.todayTransactions || 0} транзакцій`} />
              <View style={s.divider} />
              <CashflowItem label="Вчора" value={cashflow.yesterday || 0} color="#3B82F6" />
              <View style={s.divider} />
              <CashflowItem label="Тиждень" value={cashflow.week || 0} color="#0F0F10" />
            </View>
            {/* Mini chart */}
            {cashflow.daily?.length > 0 && (
              <View style={s.chartRow}>
                {cashflow.daily.map((d: any, i: number) => {
                  const max = Math.max(...cashflow.daily.map((x: any) => x.amount || 1));
                  const h = Math.max(4, (d.amount / (max || 1)) * 50);
                  return (
                    <View key={i} style={s.chartBar}>
                      <View style={[s.chartFill, { height: h, backgroundColor: i === cashflow.daily.length - 1 ? '#E30613' : '#E5E7EB' }]} />
                      <Text style={s.chartLabel}>{d.date}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </>
      )}

      {/* Revenue Breakdown */}
      {data && (
        <>
          <Text style={s.sectionTitle}>Джерела доходу</Text>
          <View style={s.revenueCard}>
            <RevenueRow label="SaaS підписка" value={`${data.saas?.monthly || 0} ₴/міс`} />
            <RevenueRow label="Marketplace" value={`${data.marketplace?.month || 0} ₴`} />
            <RevenueRow label="Комісія платформи" value={`${data.commission?.month || 0} ₴`} />
          </View>
        </>
      )}

      {/* Debtors */}
      {debtors?.debtors?.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Боржники ({debtors.debtors.length})</Text>
          <View style={s.debtorsCard}>
            {debtors.debtors.slice(0, 10).map((d: any, i: number) => (
              <View key={i} style={s.debtorRow}>
                <View style={s.debtorRank}><Text style={s.debtorRankText}>{i + 1}</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.debtorName}>{d.childName}</Text>
                  {d.parentName ? <Text style={s.debtorParent}>{d.parentName}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.debtorAmount}>{d.debt.toLocaleString()} ₴</Text>
                  {d.overdue > 0 && <Text style={s.debtorOverdue}>{d.overdue} прострочено</Text>}
                </View>
              </View>
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Загальний борг</Text>
              <Text style={s.totalValue}>{(debtors.totalDebt || 0).toLocaleString()} ₴</Text>
            </View>
          </View>
        </>
      )}

      {/* Invoices */}
      <Text style={s.sectionTitle}>Рахунки</Text>
      {invoices.length === 0 ? (
        <View style={s.emptyCard}><Ionicons name="receipt-outline" size={32} color="#9CA3AF" /><Text style={s.emptyText}>Немає рахунків</Text></View>
      ) : invoices.slice(0, 10).map((inv: any, i: number) => (
        <View key={i} style={s.invoiceCard}>
          <View style={s.invoiceRow}>
            <Text style={s.invoiceDesc}>{inv.description || inv.plan || 'Рахунок'}</Text>
            <Text style={[s.invoiceStatus, inv.status === 'PAID' ? { color: '#10B981' } : inv.status === 'OVERDUE' ? { color: '#EF4444' } : { color: '#F59E0B' }]}>{inv.status}</Text>
          </View>
          <Text style={s.invoiceAmount}>{inv.amount} ₴</Text>
        </View>
      ))}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function CashflowItem({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={s.cfLabel}>{label}</Text>
      <Text style={[s.cfValue, { color }]}>+{value.toLocaleString()} ₴</Text>
      {sub && <Text style={s.cfSub}>{sub}</Text>}
    </View>
  );
}

function RevenueRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.revRow}>
      <Text style={s.revLabel}>{label}</Text>
      <Text style={s.revValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  heroCard: { backgroundColor: '#0F0F10', borderRadius: 20, padding: 24, marginTop: 12, alignItems: 'center' },
  heroLabel: { fontSize: 14, color: '#9CA3AF' },
  heroValue: { fontSize: 32, fontWeight: '800', color: '#FFF', marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F0F10', marginTop: 28, marginBottom: 14, letterSpacing: 0.3 },
  cashflowCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  cashflowRow: { flexDirection: 'row' },
  divider: { width: 1, backgroundColor: '#F3F4F6' },
  cfLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cfValue: { fontSize: 18, fontWeight: '800' },
  cfSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', height: 80, alignItems: 'flex-end' },
  chartBar: { flex: 1, alignItems: 'center' },
  chartFill: { width: 20, borderRadius: 4 },
  chartLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
  revenueCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  revRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  revLabel: { fontSize: 14, color: '#6B7280' },
  revValue: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  debtorsCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  debtorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  debtorRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  debtorRankText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  debtorName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  debtorParent: { fontSize: 12, color: '#6B7280' },
  debtorAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  debtorOverdue: { fontSize: 11, color: '#EF4444' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#EF4444' },
  emptyCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 8 },
  invoiceCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  invoiceDesc: { fontSize: 15, fontWeight: '600', color: '#1F2937', flex: 1 },
  invoiceStatus: { fontSize: 12, fontWeight: '700' },
  invoiceAmount: { fontSize: 18, fontWeight: '700', color: '#0F0F10', marginTop: 6 },
});
