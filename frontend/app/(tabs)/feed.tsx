import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

const FILTERS = [
  { key: 'all', label: 'Усі', icon: 'grid' },
  { key: 'CLUB', label: 'Клуб', icon: 'business' },
  { key: 'PERSONAL', label: 'Персональне', icon: 'person' },
  { key: 'SYSTEM', label: 'Система', icon: 'pulse' },
  { key: 'COMMERCIAL', label: 'Акції', icon: 'pricetag' },
  { key: 'COMPETITION', label: 'Змагання', icon: 'trophy' },
];

const TYPE_ICONS: Record<string, { icon: string; bg: string; color: string }> = {
  SYSTEM: { icon: 'pulse', bg: '#DBEAFE', color: '#2563EB' },
  CONTENT: { icon: 'images', bg: '#DCFCE7', color: '#16A34A' },
  COMMERCIAL: { icon: 'pricetag', bg: '#FEE2E2', color: '#DC2626' },
  CLUB: { icon: 'business', bg: '#E0E7FF', color: '#4F46E5' },
  PERSONAL: { icon: 'star', bg: '#FEF3C7', color: '#D97706' },
  COMPETITION: { icon: 'trophy', bg: '#FDE68A', color: '#92400E' },
  NEWS: { icon: 'newspaper', bg: '#F3F4F6', color: '#374151' },
};

// Event-specific styling
const EVENT_STYLES: Record<string, { icon: string; bg: string; color: string; borderColor: string }> = {
  achievement_streak: { icon: 'flame', bg: '#FEF3C7', color: '#D97706', borderColor: '#FDE68A' },
  attendance_risk: { icon: 'alert-circle', bg: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' },
  debt_reminder: { icon: 'card', bg: '#FEF2F2', color: '#DC2626', borderColor: '#FECACA' },
};

export default function FeedScreen() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      // Use the new event-aware feed endpoint
      const res = await api.get('/parent/feed');
      setItems(res?.items || []);
    } catch (e) {
      console.log('Feed error:', e);
      // Fallback to old endpoint
      try {
        const res = await api.get('/feed/home');
        setItems(res?.items || []);
      } catch { /* ignore */ }
    }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter);

  const fmtDate = (d?: string) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch { return ''; }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#E30613" />}
      showsVerticalScrollIndicator={false}>

      <View style={s.header}><Text style={s.title}>Стрічка</Text></View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
        {FILTERS.map(f => (
          <TouchableOpacity key={f.key} testID={`feed-filter-${f.key}`}
            style={[s.filterBtn, filter === f.key && s.filterActive]}
            onPress={() => setFilter(f.key)}>
            <Ionicons name={f.icon as any} size={14} color={filter === f.key ? '#fff' : '#6B7280'} />
            <Text style={[s.filterText, filter === f.key && s.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items */}
      {filtered.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="newspaper-outline" size={48} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Немає новин</Text>
          <Text style={s.emptyDesc}>Тут будуть новини клубу, досягнення та акції</Text>
        </View>
      ) : (
        <View style={s.list}>
          {filtered.map((item: any, idx: number) => {
            const isEvent = item.source === 'event' || item.source === 'achievement';
            const eventStyle = isEvent ? EVENT_STYLES[item.eventType] : null;
            const typeInfo = eventStyle || TYPE_ICONS[item.type] || TYPE_ICONS.NEWS;

            return (
              <View key={item.id || idx} testID={`feed-item-${idx}`}
                style={[s.card, isEvent && eventStyle && { borderColor: eventStyle.borderColor, borderWidth: 1.5 }]}>
                <View style={s.cardTop}>
                  <View style={[s.cardIcon, { backgroundColor: typeInfo.bg }]}>
                    <Ionicons name={(eventStyle?.icon || typeInfo.icon) as any} size={18} color={typeInfo.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.cardType}>{
                      isEvent && item.eventType === 'achievement_streak' ? 'Досягнення' :
                      isEvent && item.eventType === 'attendance_risk' ? 'Система' :
                      isEvent && item.eventType === 'debt_reminder' ? 'Фінанси' :
                      item.source === 'achievement' ? 'Досягнення' :
                      item.type === 'CLUB' ? 'Життя клубу' :
                      item.type === 'PERSONAL' ? 'Персональне' :
                      item.type === 'COMMERCIAL' ? 'Акція' :
                      item.type === 'COMPETITION' ? 'Змагання' :
                      item.type === 'SYSTEM' ? 'Система' :
                      item.type === 'CONTENT' ? 'Контент' : 'Новини'
                    }</Text>
                    <Text style={s.cardDate}>{fmtDate(item.createdAt)}</Text>
                  </View>
                  {isEvent && (
                    <View style={[s.eventTag, { backgroundColor: typeInfo.bg }]}>
                      <Text style={[s.eventTagT, { color: typeInfo.color }]}>Event</Text>
                    </View>
                  )}
                </View>
                <Text style={s.cardTitle}>{item.title}</Text>
                {item.body ? <Text style={s.cardBody} numberOfLines={3}>{item.body}</Text> : null}

                {/* CTA per type */}
                {item.type === 'COMMERCIAL' && (
                  <TouchableOpacity testID={`feed-shop-${idx}`} style={s.cardCta} onPress={() => router.push('/(tabs)/shop')}>
                    <Text style={s.cardCtaT}>Перейти в магазин</Text>
                    <Ionicons name="arrow-forward" size={14} color="#E30613" />
                  </TouchableOpacity>
                )}
                {item.type === 'COMPETITION' && (
                  <TouchableOpacity testID={`feed-comp-${idx}`} style={s.cardCta} onPress={() => router.push('/competitions' as any)}>
                    <Text style={s.cardCtaT}>Деталі змагань</Text>
                    <Ionicons name="arrow-forward" size={14} color="#D97706" />
                  </TouchableOpacity>
                )}
                {(item.type === 'PERSONAL' || item.source === 'achievement') && (
                  <TouchableOpacity testID={`feed-progress-${idx}`} style={s.cardCta} onPress={() => router.push('/(tabs)/progress')}>
                    <Text style={[s.cardCtaT, { color: '#16A34A' }]}>Переглянути прогрес</Text>
                    <Ionicons name="arrow-forward" size={14} color="#16A34A" />
                  </TouchableOpacity>
                )}
                {isEvent && item.eventType === 'debt_reminder' && (
                  <TouchableOpacity testID={`feed-pay-${idx}`} style={[s.cardCtaFull, { backgroundColor: '#DC2626' }]} onPress={() => router.push('/payments' as any)}>
                    <Ionicons name="card" size={16} color="#fff" />
                    <Text style={s.cardCtaFullT}>Оплатити</Text>
                  </TouchableOpacity>
                )}
                {isEvent && item.eventType === 'attendance_risk' && (
                  <TouchableOpacity testID={`feed-msg-${idx}`} style={[s.cardCtaFull, { backgroundColor: '#D97706' }]} onPress={() => router.push('/messages' as any)}>
                    <Ionicons name="chatbubble" size={16} color="#fff" />
                    <Text style={s.cardCtaFullT}>Написати тренеру</Text>
                  </TouchableOpacity>
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
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  filterRow: { maxHeight: 52, marginTop: 8 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTextActive: { color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  list: { paddingHorizontal: 20, marginTop: 12, gap: 10 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardType: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDate: { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardBody: { fontSize: 14, color: '#6B7280', marginTop: 6, lineHeight: 20 },
  cardCta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardCtaT: { fontSize: 13, fontWeight: '600', color: '#E30613' },
  // Full-width CTA for events
  cardCtaFull: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 12 },
  cardCtaFullT: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // Event tag
  eventTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  eventTagT: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
