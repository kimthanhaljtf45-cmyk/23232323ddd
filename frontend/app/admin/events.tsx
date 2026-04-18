import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
  warning: { bg: '#FFFBEB', text: '#78350F', border: '#FDE68A' },
  positive: { bg: '#F0FDF4', text: '#14532D', border: '#BBF7D0' },
  info: { bg: '#EFF6FF', text: '#1E3A5F', border: '#BFDBFE' },
};

export default function AdminEventsScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const url = activeFilter ? `/admin/events?event_type=${activeFilter}` : '/admin/events';
      const res = await api.get(url);
      setData(res);
    } catch (e) { console.log('Admin events error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeFilter]);

  useEffect(() => { load(); }, [load]);

  const fmtTime = (d?: string) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>;

  const events = data?.events || [];
  const stats = data?.stats || {};
  const types = data?.types || [];

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#7C3AED" />}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="events-back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Event Engine</Text>
          <Text style={s.subtitle}>Лог подій системи</Text>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: '#FEF2F2' }]}>
          <Text style={[s.statNum, { color: '#DC2626' }]}>{stats.today || 0}</Text>
          <Text style={s.statLabel}>Сьогодні</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#EFF6FF' }]}>
          <Text style={[s.statNum, { color: '#2563EB' }]}>{stats.total || 0}</Text>
          <Text style={s.statLabel}>Всього</Text>
        </View>
      </View>

      {/* Type Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
        <TouchableOpacity testID="filter-all" style={[s.filterBtn, !activeFilter && s.filterActive]} onPress={() => setActiveFilter(null)}>
          <Text style={[s.filterText, !activeFilter && s.filterTextActive]}>Усі</Text>
        </TouchableOpacity>
        {types.map((t: string) => {
          const typeInfo = stats.byType?.[t] || {};
          return (
            <TouchableOpacity key={t} testID={`filter-${t}`} style={[s.filterBtn, activeFilter === t && s.filterActive]} onPress={() => setActiveFilter(t)}>
              <Ionicons name={(typeInfo.icon || 'ellipse') as any} size={14} color={activeFilter === t ? '#fff' : typeInfo.color || '#6B7280'} />
              <Text style={[s.filterText, activeFilter === t && s.filterTextActive]}>
                {typeInfo.name || t} ({typeInfo.total || 0})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Events Table */}
      {events.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="pulse-outline" size={48} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Немає подій</Text>
          <Text style={s.emptyDesc}>Event Engine автоматично обробляє події</Text>
        </View>
      ) : (
        <View style={s.list}>
          {events.map((ev: any, idx: number) => {
            const sevStyle = SEVERITY_COLORS[ev.severity] || SEVERITY_COLORS.info;
            return (
              <View key={ev.id || idx} testID={`event-row-${idx}`}
                style={[s.eventRow, { borderLeftColor: ev.color || '#6B7280' }]}>
                <View style={s.eventHeader}>
                  <View style={[s.eventIconWrap, { backgroundColor: sevStyle.bg }]}>
                    <Ionicons name={(ev.icon || 'ellipse') as any} size={16} color={ev.color || '#6B7280'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.eventType}>{ev.typeName}</Text>
                    <Text style={s.eventTime}>{fmtTime(ev.createdAt)}</Text>
                  </View>
                  <View style={[s.severityBadge, { backgroundColor: sevStyle.bg, borderColor: sevStyle.border }]}>
                    <Text style={[s.severityText, { color: sevStyle.text }]}>{ev.severity}</Text>
                  </View>
                </View>
                <View style={s.eventBody}>
                  <Text style={s.eventChild}>{ev.childName || '—'}</Text>
                  {ev.meta && Object.keys(ev.meta).length > 0 && (
                    <View style={s.metaRow}>
                      {ev.meta.debt != null && <Text style={s.metaItem}>Борг: {ev.meta.debt} ₴</Text>}
                      {ev.meta.attendance != null && <Text style={s.metaItem}>Відвідув.: {ev.meta.attendance}%</Text>}
                      {ev.meta.consecutiveMisses != null && <Text style={s.metaItem}>Пропусків: {ev.meta.consecutiveMisses}</Text>}
                      {ev.meta.streak != null && <Text style={s.metaItem}>Серія: {ev.meta.streak}</Text>}
                    </View>
                  )}
                  {ev.actions && ev.actions.length > 0 && (
                    <View style={s.actionsRow}>
                      {ev.actions.map((a: string, i: number) => (
                        <View key={i} style={s.actionTag}>
                          <Text style={s.actionTagT}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {ev.acknowledged && (
                  <View style={s.ackBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                    <Text style={s.ackText}>Оброблено</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8' },
  scroll: { flex: 1, backgroundColor: '#F8F8F8' },
  scrollContent: { paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#6B7280', marginTop: 1 },
  // Stats
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  // Filters
  filterRow: { maxHeight: 52, marginTop: 16 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  // Empty
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  // Events list
  list: { paddingHorizontal: 20, marginTop: 16, gap: 8 },
  eventRow: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: '#E5E7EB' },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eventIconWrap: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  eventType: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  eventTime: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  severityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
  severityText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  eventBody: { marginTop: 8, marginLeft: 42 },
  eventChild: { fontSize: 14, fontWeight: '600', color: '#374151' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaItem: { fontSize: 12, color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  actionTag: { backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actionTagT: { fontSize: 10, fontWeight: '600', color: '#6D28D9' },
  ackBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, marginLeft: 42 },
  ackText: { fontSize: 11, color: '#16A34A', fontWeight: '600' },
});
