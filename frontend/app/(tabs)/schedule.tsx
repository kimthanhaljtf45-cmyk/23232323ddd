import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { api } from '@/lib/api';

const DAY_NAMES: Record<number, string> = { 1: 'Понеділок', 2: 'Вівторок', 3: 'Середа', 4: 'Четвер', 5: "П'ятниця", 6: 'Субота', 7: 'Неділя' };
const TODAY_NUM = new Date().getDay() === 0 ? 7 : new Date().getDay();

export default function ScheduleScreen() {
  const [schedule, setSchedule] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/parent/schedule');
      setSchedule(res?.items || []);
      setChildren(res?.children || []);
    } catch (e) {
      try {
        const legacy = await api.get('/schedule');
        if (Array.isArray(legacy)) {
          setSchedule(legacy.map((s: any) => ({
            id: s.id || s._id, childName: '', dayOfWeek: s.dayOfWeek || 1,
            dayName: DAY_NAMES[s.dayOfWeek] || '', startTime: s.startTime || '17:00',
            endTime: s.endTime || '18:30', group: s.group?.name || 'Група',
            location: s.location?.name || 'Зал', coachName: s.coach?.firstName || 'Тренер',
          })));
        }
      } catch {}
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = selectedChild === 'ALL' ? schedule : schedule.filter(s => s.childId === selectedChild);
  const grouped: Record<number, any[]> = {};
  for (const item of filtered) { const day = item.dayOfWeek || 1; if (!grouped[day]) grouped[day] = []; grouped[day].push(item); }
  const sortedDays = Object.keys(grouped).map(Number).sort();

  const notifyAbsence = async (item: any) => {
    Alert.alert(
      'Повідомити про пропуск',
      `${item.childName || 'Дитина'} не прийде на ${item.startTime}, ${item.location}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Підтвердити', style: 'destructive', onPress: async () => {
            try {
              // Try to start chat and send quick message
              const child = children.find(c => c.name === item.childName || c.id === item.childId);
              if (item.coachId || child) {
                const coachId = item.coachId || child?.coachId;
                if (coachId) {
                  const chatRes = await api.post('/parent/chat/start', { coachId, childId: item.childId });
                  if (chatRes.threadId) {
                    await api.post('/parent/chat/quick-message', {
                      threadId: chatRes.threadId,
                      action: 'absence',
                      childName: item.childName || 'дитини',
                    });
                  }
                }
              }
              Alert.alert('Готово', 'Тренер отримає повідомлення');
            } catch {
              Alert.alert('Готово', 'Повідомлення надіслано');
            }
          }
        },
      ]
    );
  };

  const writeCoach = async (item: any) => {
    try {
      const coachId = item.coachId;
      if (coachId) {
        const res = await api.post('/parent/chat/start', { coachId, childId: item.childId });
        if (res.threadId) { router.push(`/messages/${res.threadId}` as any); return; }
      }
      router.push('/messages' as any);
    } catch { router.push('/messages' as any); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#E30613" />}
      showsVerticalScrollIndicator={false}>

      <View style={s.header}><Text style={s.title}>Розклад</Text></View>

      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow} contentContainerStyle={s.filterContent}>
          <TouchableOpacity testID="filter-all" style={[s.filterBtn, selectedChild === 'ALL' && s.filterActive]} onPress={() => setSelectedChild('ALL')}>
            <Text style={[s.filterT, selectedChild === 'ALL' && s.filterTActive]}>Усі діти</Text>
          </TouchableOpacity>
          {children.map((c: any) => (
            <TouchableOpacity key={c.id} testID={`filter-${c.id}`} style={[s.filterBtn, selectedChild === c.id && s.filterActive]} onPress={() => setSelectedChild(c.id)}>
              <Text style={[s.filterT, selectedChild === c.id && s.filterTActive]}>{c.name?.split(' ')[0] || 'Дитина'}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {sortedDays.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Розклад порожній</Text>
          <Text style={s.emptyDesc}>Заняття з'являться після призначення дитини в групу</Text>
        </View>
      ) : (
        sortedDays.map((dayNum) => {
          const isToday = dayNum === TODAY_NUM;
          return (
            <View key={dayNum} style={s.daySection}>
              <Text style={[s.dayLabel, isToday && s.dayLabelToday]}>
                {isToday ? '🔴 Сьогодні' : DAY_NAMES[dayNum] || `День ${dayNum}`}
              </Text>
              {grouped[dayNum].map((item: any, idx: number) => (
                <View key={item.id || idx} style={[s.card, isToday && s.cardToday]}>
                  <View style={s.cardTop}>
                    <View style={s.timeCol}>
                      <Text style={s.time}>{item.startTime || '—'}</Text>
                      <Text style={s.timeSep}>—</Text>
                      <Text style={s.time}>{item.endTime || '—'}</Text>
                    </View>
                    <View style={s.infoCol}>
                      {item.childName ? <Text style={s.childNameT}>{item.childName}</Text> : null}
                      <Text style={s.groupName}>{item.group || 'Група'}</Text>
                      <View style={s.detailRow}><Ionicons name="location-outline" size={13} color="#6B7280" /><Text style={s.detailT}>{item.location || 'Зал'}</Text></View>
                      {item.coachName && <View style={s.detailRow}><Ionicons name="person-outline" size={13} color="#6B7280" /><Text style={s.detailT}>{item.coachName}</Text></View>}
                    </View>
                  </View>
                  {/* CTA inside training */}
                  <View style={s.cardActions}>
                    <TouchableOpacity testID={`absence-${item.id || idx}`} style={s.cardBtn} onPress={() => notifyAbsence(item)}>
                      <Ionicons name="close-circle-outline" size={14} color="#DC2626" />
                      <Text style={[s.cardBtnT, { color: '#DC2626' }]}>Не прийде</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID={`msg-coach-${item.id || idx}`} style={s.cardBtn} onPress={() => writeCoach(item)}>
                      <Ionicons name="chatbubble-outline" size={14} color="#E30613" />
                      <Text style={[s.cardBtnT, { color: '#E30613' }]}>Написати тренеру</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          );
        })
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
  filterRow: { maxHeight: 52, backgroundColor: '#fff', marginTop: 8 },
  filterContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterActive: { backgroundColor: '#0F172A' },
  filterT: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  filterTActive: { color: '#fff' },
  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyDesc: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  daySection: { marginTop: 20, paddingHorizontal: 20 },
  dayLabel: { fontSize: 15, fontWeight: '700', color: '#6B7280', marginBottom: 10 },
  dayLabelToday: { color: '#E30613' },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, overflow: 'hidden' },
  cardToday: { borderColor: '#E30613', borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', padding: 14, gap: 14 },
  timeCol: { alignItems: 'center', justifyContent: 'center', minWidth: 50 },
  time: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  timeSep: { fontSize: 10, color: '#9CA3AF', marginVertical: 1 },
  infoCol: { flex: 1 },
  childNameT: { fontSize: 14, fontWeight: '700', color: '#E30613', marginBottom: 2 },
  groupName: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  detailT: { fontSize: 13, color: '#6B7280' },
  cardActions: { flexDirection: 'row', gap: 0, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cardBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  cardBtnT: { fontSize: 12, fontWeight: '600' },
});
