import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

const TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  OWNER_INSIGHT_PUSH: { icon: 'alert-circle', color: '#EF4444' },
  PROMOTION: { icon: 'megaphone', color: '#F59E0B' },
  DEBT_REMINDER: { icon: 'cash', color: '#EF4444' },
  ATTENDANCE: { icon: 'calendar', color: '#3B82F6' },
  COACH_MESSAGE: { icon: 'chatbubble', color: '#8B5CF6' },
};

export default function OwnerNotifications() {
  const [notifs, setNotifs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [nRes, eRes] = await Promise.allSettled([
        api.get('/owner/notifications'),
        api.get('/owner/events'),
      ]);
      if (nRes.status === 'fulfilled') {
        setNotifs((nRes.value.data || nRes.value)?.notifications || []);
        setUnread((nRes.value.data || nRes.value)?.unread || 0);
      }
      if (eRes.status === 'fulfilled') setEvents((eRes.value.data || eRes.value)?.events || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const markAllRead = async () => {
    try {
      await api.post('/owner/notifications/read-all');
      setUnread(0);
      fetchData();
    } catch {}
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}>
      {/* Header */}
      <View style={s.headerRow}>
        <Text style={s.title}>Сповіщення</Text>
        {unread > 0 && (
          <TouchableOpacity testID="mark-all-read" onPress={markAllRead} style={s.markBtn}>
            <Text style={s.markBtnText}>Прочитати всі</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Business Events */}
      {events.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Сигнали бізнесу</Text>
          {events.map((e, i) => {
            const lc = e.level === 'high' ? '#EF4444' : e.level === 'medium' ? '#F59E0B' : e.level === 'positive' ? '#10B981' : '#6B7280';
            const bg = e.level === 'high' ? '#FEF2F2' : e.level === 'medium' ? '#FFFBEB' : e.level === 'positive' ? '#F0FDF4' : '#F9FAFB';
            return (
              <View key={i} style={[s.eventCard, { backgroundColor: bg }]} testID={`event-${e.type}`}>
                <View style={[s.eventDot, { backgroundColor: lc }]} />
                <View style={s.eventContent}>
                  <Text style={s.eventTitle}>{e.title}</Text>
                  <Text style={s.eventDetail}>{e.detail}</Text>
                </View>
                {e.actionLabel ? (
                  <TouchableOpacity style={[s.eventBtn, { borderColor: lc }]}>
                    <Text style={[s.eventBtnText, { color: lc }]}>{e.actionLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </>
      )}

      {/* Notifications */}
      <Text style={s.sectionTitle}>Історія {unread > 0 ? `(${unread} нових)` : ''}</Text>
      {notifs.length === 0 ? (
        <View style={s.emptyCard}>
          <Ionicons name="notifications-off-outline" size={40} color="#D1D5DB" />
          <Text style={s.emptyText}>Немає сповіщень</Text>
        </View>
      ) : notifs.map((n, i) => {
        const cfg = TYPE_CONFIG[n.type] || { icon: 'notifications' as any, color: '#6B7280' };
        return (
          <View key={i} style={[s.notifCard, !n.isRead && s.notifUnread]} testID={`notif-${i}`}>
            <View style={[s.notifIcon, { backgroundColor: cfg.color + '15' }]}>
              <Ionicons name={cfg.icon} size={20} color={cfg.color} />
            </View>
            <View style={s.notifContent}>
              <Text style={s.notifTitle}>{n.title}</Text>
              <Text style={s.notifBody}>{n.body}</Text>
            </View>
            {!n.isRead && <View style={s.unreadDot} />}
          </View>
        );
      })}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  markBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  markBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#4B5563', marginTop: 20, marginBottom: 8 },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 8 },
  eventDot: { width: 10, height: 10, borderRadius: 5 },
  eventContent: { flex: 1, marginLeft: 12 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  eventDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  eventBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  eventBtnText: { fontSize: 12, fontWeight: '700' },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: '#F3F4F6' },
  notifUnread: { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' },
  notifIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1, marginLeft: 12 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  notifBody: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E30613' },
  emptyCard: { alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 8 },
});
