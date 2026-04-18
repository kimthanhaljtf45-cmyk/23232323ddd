import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

/**
 * JUNIOR X10 — АКТИВНІСТЬ
 * Meaningful feed, 4 типа:
 *  - Всі
 *  - Досягнення (achievements + belt progress)
 *  - Тренер (coach messages/feedback)
 *  - Клуб (competitions, announcements, photos)
 */

type FilterKey = 'all' | 'achievements' | 'coach' | 'club';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'Всі' },
  { key: 'achievements', label: 'Досягнення' },
  { key: 'coach', label: 'Тренер' },
  { key: 'club', label: 'Клуб' },
];

const TYPE_CFG: Record<string, { icon: string; color: string; bg: string; category: FilterKey }> = {
  achievement: { icon: 'trophy', color: '#F59E0B', bg: '#FFFBEB', category: 'achievements' },
  xp: { icon: 'star', color: '#F59E0B', bg: '#FFFBEB', category: 'achievements' },
  belt: { icon: 'ribbon', color: '#7C3AED', bg: '#F5F3FF', category: 'achievements' },
  level: { icon: 'trending-up', color: '#10B981', bg: '#F0FDF4', category: 'achievements' },
  streak: { icon: 'flame', color: '#EF4444', bg: '#FEF2F2', category: 'achievements' },
  coach_message: { icon: 'chatbubble-ellipses', color: '#7C3AED', bg: '#F5F3FF', category: 'coach' },
  coach_feedback: { icon: 'person', color: '#7C3AED', bg: '#F5F3FF', category: 'coach' },
  coach: { icon: 'person', color: '#7C3AED', bg: '#F5F3FF', category: 'coach' },
  competition: { icon: 'trophy', color: '#F59E0B', bg: '#FFFBEB', category: 'club' },
  announcement: { icon: 'megaphone', color: '#3B82F6', bg: '#EFF6FF', category: 'club' },
  club: { icon: 'people', color: '#3B82F6', bg: '#EFF6FF', category: 'club' },
  photo: { icon: 'camera', color: '#EC4899', bg: '#FDF2F8', category: 'club' },
  training: { icon: 'fitness', color: '#3B82F6', bg: '#EFF6FF', category: 'club' },
  reminder: { icon: 'alarm', color: '#6B7280', bg: '#F3F4F6', category: 'club' },
  system: { icon: 'information-circle', color: '#6B7280', bg: '#F3F4F6', category: 'club' },
};

function ActivityCard({ item, onAction }: { item: any; onAction: (type: string, item: any) => void }) {
  const cfg = TYPE_CFG[item.type] || TYPE_CFG.system;
  const timeAgo = item.timeAgo || item.time || '';
  const category = cfg.category;

  // Sprint 3 MUST: priority weight (from backend) drives visual hierarchy
  const priority: 'critical' | 'important' | 'info' = item.priority || 'info';
  const priorityStyle =
    priority === 'critical' ? s.cardCritical :
    priority === 'important' ? s.cardImportant :
    s.cardInfo;
  const priorityBorder =
    priority === 'critical' ? '#E30613' :
    priority === 'important' ? '#F59E0B' :
    cfg.color;

  // Action per category
  const actions: { label: string; icon: string; act: string }[] = [];
  if (category === 'coach') {
    actions.push({ label: 'Написати тренеру', icon: 'chatbubble-ellipses', act: 'write_coach' });
  } else if (category === 'club' && (item.type === 'competition' || item.type === 'announcement')) {
    actions.push({ label: 'Деталі', icon: 'arrow-forward', act: 'details' });
  } else if (category === 'club' && (item.type === 'training' || item.type === 'reminder')) {
    actions.push({ label: 'До тренувань', icon: 'calendar', act: 'to_schedule' });
  } else if (category === 'achievements' && item.type === 'belt') {
    actions.push({ label: 'Мій прогрес', icon: 'trophy', act: 'to_progress' });
  }

  return (
    <View style={[s.card, priorityStyle, { borderLeftColor: priorityBorder }]} testID={`activity-${item.id}`}>
      {priority === 'critical' && (
        <View style={s.priorityBadge} testID={`priority-${item.id}-critical`}>
          <Ionicons name="alert-circle" size={10} color="#FFF" />
          <Text style={s.priorityBadgeT}>ВАЖЛИВО</Text>
        </View>
      )}
      <View style={s.cardTop}>
        <View style={[s.cardIcon, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardTitle} numberOfLines={2}>
            {item.title || item.text}
          </Text>
          {item.description && <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>}
          {timeAgo && <Text style={s.cardTime}>{timeAgo}</Text>}
        </View>
        {item.xp && (
          <View style={s.xpBadge}>
            <Text style={s.xpBadgeT}>+{item.xp} XP</Text>
          </View>
        )}
      </View>
      {actions.length > 0 && (
        <View style={s.cardActions}>
          {actions.map((a, i) => (
            <TouchableOpacity
              key={i}
              testID={`action-${item.id}-${a.act}`}
              style={[s.actionBtn, priority === 'critical' && s.actionBtnCritical]}
              onPress={() => onAction(a.act, item)}
            >
              <Ionicons name={a.icon as any} size={13} color={priority === 'critical' ? '#FFF' : '#7C3AED'} />
              <Text style={[s.actionBtnT, priority === 'critical' && s.actionBtnTCritical]}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function StudentFeed() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const router = useRouter();

  const handleAction = (type: string, _item: any) => {
    switch (type) {
      case 'write_coach':
        router.push({ pathname: '/(student)', params: { openCoach: '1' } } as any);
        break;
      case 'to_schedule':
        router.push('/(student)/schedule' as any);
        break;
      case 'to_progress':
        router.push('/(student)/progress' as any);
        break;
      case 'details':
        router.push('/(student)/schedule' as any);
        break;
    }
  };

  const fetchData = async () => {
    try {
      const r = await api.get('/student/feed');
      const d: any = (r as any).data || r;
      const list = d?.items || d?.feed || d || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const getCategory = (it: any): FilterKey => {
    const c = TYPE_CFG[it.type];
    return c?.category || 'club';
  };

  const filtered = filter === 'all' ? items : items.filter((it) => getCategory(it) === filter);

  const getCount = (key: FilterKey): number => {
    if (key === 'all') return items.length;
    return items.filter((it) => getCategory(it) === key).length;
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#E30613" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsWrap}
        contentContainerStyle={s.tabs}
      >
        {FILTERS.map((f) => {
          const count = getCount(f.key);
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              testID={`feed-filter-${f.key}`}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.tabT, active && s.tabTActive]}>{f.label}</Text>
              {count > 0 && (
                <View style={[s.tabBadge, active && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeT, active && s.tabBadgeTActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
        {filtered.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="newspaper-outline" size={40} color="#D1D5DB" />
            <Text style={s.emptyT}>
              {filter === 'all'
                ? 'Поки немає активностей'
                : `Немає подій у категорії «${FILTERS.find((f) => f.key === filter)?.label}»`}
            </Text>
            <Text style={s.emptyS}>Тренуйся — і стрічка оживе</Text>
          </View>
        ) : (
          filtered.map((it, i) => <ActivityCard key={it.id || i} item={it} onAction={handleAction} />)
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  tabsWrap: {
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    maxHeight: 56,
    flexGrow: 0,
  },
  tabs: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabActive: { backgroundColor: '#0F0F10', borderColor: '#0F0F10' },
  tabT: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTActive: { color: '#FFF' },
  tabBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  tabBadgeActive: { backgroundColor: '#374151' },
  tabBadgeT: { fontSize: 11, fontWeight: '800', color: '#9CA3AF' },
  tabBadgeTActive: { color: '#E30613' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderLeftWidth: 4,
    position: 'relative',
  },
  // Sprint 3 MUST: priority weights
  cardCritical: { borderLeftWidth: 5, borderColor: '#FECACA', backgroundColor: '#FFFBFA' },
  cardImportant: { borderLeftWidth: 4, borderColor: '#FDE68A' },
  cardInfo: { borderLeftWidth: 3, opacity: 0.92 },
  priorityBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E30613',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  priorityBadgeT: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  actionBtnCritical: { backgroundColor: '#E30613' },
  actionBtnTCritical: { color: '#FFF' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  cardDesc: { fontSize: 12, color: '#4B5563', marginTop: 4 },
  cardTime: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },

  xpBadge: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  xpBadgeT: { fontSize: 11, fontWeight: '800', color: '#F59E0B' },

  // Action triggers in feed card
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnT: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyT: { fontSize: 14, color: '#6B7280', marginTop: 10, fontWeight: '600', textAlign: 'center' },
  emptyS: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
