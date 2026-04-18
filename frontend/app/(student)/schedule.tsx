import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Modal, Alert, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

const DAYS_HEADER = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const REASONS = ['Хворію', 'Не встигаю', 'Травма', 'Сімейні обставини', 'Інше'];

function CalendarGrid({ data, selectedDate, onSelect }: { data: any; selectedDate: string; onSelect: (d: string) => void }) {
  const days = data?.days || [];
  const firstDow = data?.firstDayOfWeek || 1;
  const blanks = firstDow - 1;

  return (
    <View testID="calendar-grid">
      {/* Day headers */}
      <View style={c.headerRow}>
        {DAYS_HEADER.map(d => <Text key={d} style={c.headerCell}>{d}</Text>)}
      </View>
      {/* Grid */}
      <View style={c.grid}>
        {Array.from({ length: blanks }).map((_, i) => <View key={`b${i}`} style={c.cell} />)}
        {days.map((day: any) => {
          const isSelected = day.date === selectedDate;
          const isToday = day.isToday;
          const has = day.hasTraining;
          const att = day.attendance;
          return (
            <TouchableOpacity
              key={day.date}
              testID={`cal-day-${day.day}`}
              style={[c.cell, isSelected && c.cellSelected, isToday && !isSelected && c.cellToday]}
              onPress={() => onSelect(day.date)}
            >
              <Text style={[c.cellText, isSelected && c.cellTextSelected, day.isPast && !has && c.cellTextPast]}>{day.day}</Text>
              {has && (
                <View style={[
                  c.dot,
                  att === 'PRESENT' ? c.dotGreen : att === 'ABSENT' ? c.dotRed : (day.isPast ? c.dotGray : c.dotAccent)
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function DayDetail({ day, onConfirm, onAbsence }: { day: any; onConfirm: () => void; onAbsence: () => void }) {
  if (!day) return null;
  const trainings = day.trainings || [];
  if (trainings.length === 0) {
    return (
      <View style={s.detailEmpty}>
        <Ionicons name="moon-outline" size={24} color="#D1D5DB" />
        <Text style={s.detailEmptyText}>Вихідний</Text>
      </View>
    );
  }
  const isActionable = day.isToday || (!day.isPast && !day.attendance);
  return (
    <View>
      {trainings.map((t: any, i: number) => (
        <View key={i} style={s.trainingCard} testID={`training-detail-${i}`}>
          <View style={s.timeCol}>
            <Text style={s.timeStart}>{t.startTime}</Text>
            <Text style={s.timeEnd}>{t.endTime}</Text>
          </View>
          <View style={s.divider} />
          <View style={{ flex: 1 }}>
            <Text style={s.tGroup}>{t.group}</Text>
            <View style={s.tLocRow}>
              <Ionicons name="location-outline" size={12} color="#6B7280" />
              <Text style={s.tLoc}>{t.location}</Text>
            </View>
            {t.address ? <Text style={s.tAddr}>{t.address}</Text> : null}
          </View>
          {day.attendance === 'PRESENT' && <View style={s.attBadgeGreen}><Ionicons name="checkmark" size={14} color="#FFF" /></View>}
          {day.attendance === 'ABSENT' && <View style={s.attBadgeRed}><Ionicons name="close" size={14} color="#FFF" /></View>}
        </View>
      ))}
      {isActionable && (
        <View style={s.actionRow}>
          <TouchableOpacity testID="schedule-confirm" style={s.actionConfirm} onPress={onConfirm}>
            <Ionicons name="checkmark" size={16} color="#FFF" /><Text style={s.actionConfirmT}>Підтвердити</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="schedule-absence" style={s.actionAbsence} onPress={onAbsence}>
            <Text style={s.actionAbsenceT}>Не прийду</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function Legend() {
  return (
    <View style={s.legend}>
      <View style={s.legendItem}><View style={[c.dot, c.dotAccent, { position: 'relative' as const }]} /><Text style={s.legendText}>Заплановано</Text></View>
      <View style={s.legendItem}><View style={[c.dot, c.dotGreen, { position: 'relative' as const }]} /><Text style={s.legendText}>Був</Text></View>
      <View style={s.legendItem}><View style={[c.dot, c.dotRed, { position: 'relative' as const }]} /><Text style={s.legendText}>Пропуск</Text></View>
      <View style={s.legendItem}><View style={[c.dot, c.dotGray, { position: 'relative' as const }]} /><Text style={s.legendText}>Минуле</Text></View>
    </View>
  );
}

export default function StudentSchedule() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState('');
  const [showAbsence, setShowAbsence] = useState(false);
  const [showSlots, setShowSlots] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [absenceReason, setAbsenceReason] = useState('');

  const fetchData = async (offset: number) => {
    try {
      const res = await api.get(`/student/schedule-calendar?month=${offset}`);
      const d = res.data || res;
      setData(d);
      const today = (d.days || []).find((day: any) => day.isToday);
      if (today) setSelectedDate(today.date);
      else {
        const first = (d.days || []).find((day: any) => day.hasTraining && !day.isPast);
        if (first) setSelectedDate(first.date);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(monthOffset); }, [monthOffset]));

  const changeMonth = (dir: number) => { setMonthOffset(prev => prev + dir); setLoading(true); };

  const handleConfirm = async () => {
    try { await api.post('/student/confirm-training', { status: 'CONFIRMED' }); Alert.alert('✅', 'Підтверджено'); fetchData(monthOffset); } catch { Alert.alert('Помилка'); }
  };

  const sendAbsence = async (reason: string) => {
    try { await api.post('/student/absence', { reason }); Alert.alert('✅', 'Тренер повідомлений'); setShowAbsence(false); fetchData(monthOffset); } catch { Alert.alert('Помилка'); }
  };

  const openReschedule = async (reason: string) => {
    setAbsenceReason(reason);
    setShowAbsence(false);
    try {
      const res = await api.get('/training/available-slots');
      const s = (res.data || res)?.slots || [];
      setSlots(s);
      setShowSlots(true);
    } catch { Alert.alert('Помилка'); }
  };

  const doReschedule = async (slot: any) => {
    try {
      await api.post('/training/reschedule', { reason: absenceReason || 'Перенесення', newDate: slot.date, newTime: slot.startTime });
      Alert.alert('✅', `Тренування перенесено на ${slot.dayName} ${slot.dateLabel} о ${slot.startTime}`);
      setShowSlots(false);
      fetchData(monthOffset);
    } catch { Alert.alert('Помилка'); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;
  if (!data) return <View style={s.center}><Text style={{ color: '#6B7280' }}>Помилка</Text></View>;

  const selectedDay = (data.days || []).find((d: any) => d.date === selectedDate);
  const stats = data.stats || {};

  // NEXT TRAINING HERO (Sprint 3): find first upcoming non-past training with isToday first
  const allDays: any[] = data.days || [];
  const todayDay = allDays.find((d: any) => d.isToday && d.hasTraining && d.attendance !== 'PRESENT' && d.attendance !== 'ABSENT');
  const nextDay = todayDay || allDays.find((d: any) => !d.isPast && d.hasTraining && !d.attendance);
  const nextTraining = nextDay?.trainings?.[0];
  const isToday = todayDay != null;

  return (
    <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(monthOffset); }} tintColor="#E30613" />}>
      <Text style={s.title}>Тренування</Text>

      {data.group && (
        <View style={s.groupBanner} testID="group-info">
          <Ionicons name="location" size={14} color="#E30613" />
          <Text style={s.groupText}>{data.group} · {data.location}</Text>
        </View>
      )}

      {/* NEXT TRAINING HERO (operational) */}
      {nextTraining && nextDay && (
        <View style={s.nextHero} testID="schedule-next-hero">
          <View style={s.nextBadgeRow}>
            <View style={[s.nextBadge, isToday && s.nextBadgeToday]}>
              <Text style={s.nextBadgeT}>{isToday ? 'СЬОГОДНІ' : 'НАСТУПНЕ'}</Text>
            </View>
            <Text style={s.nextTime}>{nextTraining.startTime}–{nextTraining.endTime}</Text>
          </View>
          <Text style={s.nextTitle}>{nextTraining.group || nextTraining.location || 'Тренування'}</Text>
          {nextDay.dayName && (
            <Text style={s.nextMeta}>
              {nextDay.dayName}, {nextDay.day} {data.monthName?.toLowerCase()}
              {nextTraining.location ? ` · ${nextTraining.location}` : ''}
            </Text>
          )}
          {isToday && (
            <View style={s.nextActions}>
              <TouchableOpacity testID="next-confirm-btn" style={s.nextConfirm} onPress={handleConfirm}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={s.nextConfirmT}>Підтвердити</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="next-skip-btn" style={s.nextSkip} onPress={() => setShowAbsence(true)}>
                <Text style={s.nextSkipT}>Не прийду</Text>
              </TouchableOpacity>
            </View>
          )}
          {!isToday && (
            <TouchableOpacity
              testID="next-select-btn"
              style={s.nextGhost}
              onPress={() => setSelectedDate(nextDay.date)}
            >
              <Ionicons name="arrow-down" size={14} color="#0F0F10" />
              <Text style={s.nextGhostT}>Показати у календарі</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <View style={s.monthNav}>
        <TouchableOpacity testID="prev-month" onPress={() => changeMonth(-1)} style={s.navBtn}><Ionicons name="chevron-back" size={22} color="#374151" /></TouchableOpacity>
        <Text style={s.monthTitle}>{data.monthName} {data.year}</Text>
        <TouchableOpacity testID="next-month" onPress={() => changeMonth(1)} style={s.navBtn}><Ionicons name="chevron-forward" size={22} color="#374151" /></TouchableOpacity>
      </View>

      <View style={s.calCard}>
        <CalendarGrid data={data} selectedDate={selectedDate} onSelect={setSelectedDate} />
      </View>

      <Legend />

      <View style={s.statsRow}>
        <View style={s.statItem}><Text style={s.statVal}>{stats.totalTrainings}</Text><Text style={s.statLbl}>всього</Text></View>
        <View style={s.statItem}><Text style={[s.statVal, { color: '#10B981' }]}>{stats.attended}</Text><Text style={s.statLbl}>був</Text></View>
        <View style={s.statItem}><Text style={[s.statVal, { color: '#EF4444' }]}>{stats.missed}</Text><Text style={s.statLbl}>пропуск</Text></View>
        <View style={s.statItem}><Text style={[s.statVal, { color: '#3B82F6' }]}>{stats.upcoming}</Text><Text style={s.statLbl}>попереду</Text></View>
      </View>

      {selectedDay && (
        <View style={s.detailSection}>
          <Text style={s.detailTitle}>{selectedDay.dayName}, {selectedDay.day} {data.monthName?.toLowerCase()}</Text>
          <DayDetail day={selectedDay} onConfirm={handleConfirm} onAbsence={() => setShowAbsence(true)} />
        </View>
      )}

      <View style={{ height: 30 }} />

      {/* ABSENCE MODAL — with Reschedule */}
      <Modal visible={showAbsence} transparent animationType="slide">
        <View style={s.modalOv}>
          <View style={s.modalC}>
            <View style={s.modalH}><Text style={s.modalT}>Не прийду</Text><TouchableOpacity onPress={() => setShowAbsence(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity></View>

            <Text style={s.modalSubtitle}>Хочеш не втрачати тренування?</Text>
            <TouchableOpacity testID="reschedule-option" style={s.rescheduleBtn} onPress={() => openReschedule('')}>
              <Ionicons name="swap-horizontal" size={20} color="#FFF" />
              <Text style={s.rescheduleBtnT}>Перенести тренування</Text>
            </TouchableOpacity>

            <Text style={s.orText}>або повідомити причину:</Text>
            {REASONS.map(r => <TouchableOpacity key={r} testID={`reason-${r}`} style={s.reasonBtn} onPress={() => sendAbsence(r)}><Text style={s.reasonT}>{r}</Text><Ionicons name="chevron-forward" size={16} color="#9CA3AF" /></TouchableOpacity>)}
          </View>
        </View>
      </Modal>

      {/* SLOTS MODAL */}
      <Modal visible={showSlots} transparent animationType="slide">
        <View style={s.modalOv}>
          <View style={[s.modalC, { maxHeight: '70%' }]}>
            <View style={s.modalH}><Text style={s.modalT}>Доступні слоти</Text><TouchableOpacity onPress={() => setShowSlots(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity></View>
            <ScrollView>
              {slots.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30 }}><Text style={{ color: '#9CA3AF' }}>Немає доступних слотів</Text></View>
              ) : (
                slots.map((sl: any, i: number) => (
                  <TouchableOpacity key={i} testID={`slot-${i}`} style={s.slotCard} onPress={() => doReschedule(sl)}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotDay}>{sl.dayName}, {sl.dateLabel}</Text>
                      <Text style={s.slotTime}>{sl.startTime}–{sl.endTime}</Text>
                      <Text style={s.slotLoc}>{sl.group} · {sl.location}</Text>
                    </View>
                    <View style={s.slotAvail}><Text style={s.slotAvailT}>{sl.available} місць</Text></View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const c = StyleSheet.create({
  headerRow: { flexDirection: 'row', marginBottom: 4 },
  headerCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#9CA3AF', paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%' as any, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  cellSelected: { backgroundColor: '#E30613', borderRadius: 20 },
  cellToday: { backgroundColor: '#FEF2F2', borderRadius: 20 },
  cellText: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  cellTextSelected: { color: '#FFF' },
  cellTextPast: { color: '#D1D5DB' },
  dot: { width: 6, height: 6, borderRadius: 3, position: 'absolute', bottom: 4 },
  dotAccent: { backgroundColor: '#E30613' },
  dotGreen: { backgroundColor: '#10B981' },
  dotRed: { backgroundColor: '#EF4444' },
  dotGray: { backgroundColor: '#D1D5DB' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  title: { fontSize: 24, fontWeight: '800', color: '#0F0F10', marginTop: 16 },
  // Group
  groupBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  groupText: { fontSize: 14, fontWeight: '600', color: '#374151' },

  // NEXT TRAINING HERO (Sprint 3)
  nextHero: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  nextBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  nextBadge: { backgroundColor: '#6B7280', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  nextBadgeToday: { backgroundColor: '#E30613' },
  nextBadgeT: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  nextTime: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  nextTitle: { fontSize: 18, fontWeight: '800', color: '#0F0F10', marginTop: 4 },
  nextMeta: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  nextActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  nextConfirm: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12 },
  nextConfirmT: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  nextSkip: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12 },
  nextSkipT: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  nextGhost: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 8 },
  nextGhostT: { fontSize: 13, fontWeight: '600', color: '#0F0F10' },
  // Month nav
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  navBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  monthTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  // Calendar card
  calCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  // Legend
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 11, color: '#6B7280' },
  // Stats
  statsRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  statItem: { flex: 1, backgroundColor: '#FFF', borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  statVal: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  statLbl: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  // Detail
  detailSection: { marginTop: 16 },
  detailTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
  detailEmpty: { alignItems: 'center', paddingVertical: 20 },
  detailEmptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 6 },
  // Training card
  trainingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  timeCol: { width: 50, alignItems: 'center' },
  timeStart: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  timeEnd: { fontSize: 12, color: '#9CA3AF' },
  divider: { width: 1, height: 36, backgroundColor: '#E5E7EB', marginHorizontal: 12 },
  tGroup: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  tLocRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  tLoc: { fontSize: 13, color: '#6B7280' },
  tAddr: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  // Attendance badges
  attBadgeGreen: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  attBadgeRed: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  // Action buttons
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionConfirm: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#10B981', borderRadius: 10, paddingVertical: 12 },
  actionConfirmT: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  actionAbsence: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 12 },
  actionAbsenceT: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  // Modal
  modalOv: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalC: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalT: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  reasonBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reasonT: { fontSize: 16, color: '#0F0F10' },
  // Reschedule
  modalSubtitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 10 },
  rescheduleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E30613', borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  rescheduleBtnT: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  orText: { fontSize: 13, color: '#9CA3AF', marginBottom: 8 },
  // Slot card
  slotCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  slotDay: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  slotTime: { fontSize: 14, fontWeight: '600', color: '#E30613', marginTop: 2 },
  slotLoc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  slotAvail: { backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  slotAvailT: { fontSize: 12, fontWeight: '600', color: '#065F46' },
});
