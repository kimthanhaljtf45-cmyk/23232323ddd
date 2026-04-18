import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * COACH SCHEDULE - ТРИРІВНЕВИЙ РОЗКЛАД
 * 
 * Рівень 1 - МІСЯЦЬ: Календарна сітка з позначками
 *   ● - є тренування
 *   ⚠ - є проблеми (низька attendance / unpaid / пропуски)
 * 
 * Рівень 2 - ДЕНЬ: Список тренувань при кліку на день
 *   - час
 *   - група
 *   - учнів прийшло/не прийшло
 * 
 * Рівень 3 - ТРЕНУВАННЯ: Attendance flow
 *   - mark attendance при кліку
 */

interface DayTraining {
  id: string;
  time: string;
  groupName: string;
  groupId: string;
  present: number;
  absent: number;
  total: number;
  status: 'completed' | 'upcoming' | 'in_progress' | 'problem';
}

interface DayInfo {
  hasTraining: boolean;
  hasProblem: boolean;
  trainingsCount: number;
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
];
const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
];

// Helper functions (defined before component to avoid hoisting issues)
const getDaysInMonth = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
};

const getFirstDayOfMonth = (date: Date) => {
  const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
};

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CoachScheduleScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [dayTrainings, setDayTrainings] = useState<DayTraining[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [coachGroups, setCoachGroups] = useState<any[]>([]);
  const [massTarget, setMassTarget] = useState<{ scheduleId: string; groupId: string; groupName: string; time: string } | null>(null);
  const [massText, setMassText] = useState('');
  const [sending, setSending] = useState(false);

  const openMassMessage = (training: DayTraining) => {
    setMassTarget({ scheduleId: training.id, groupId: training.groupId, groupName: training.groupName, time: training.time });
    setMassText(`Нагадую: тренування ${training.groupName} о ${training.time}. Не запізнюйтесь 💪`);
  };

  const sendMassMessage = async () => {
    if (!massTarget || !massText.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/coach/mass-message', {
        scheduleId: massTarget.scheduleId,
        groupId: massTarget.groupId,
        text: massText.trim(),
        target: 'both',
      });
      const d: any = res.data || res;
      Alert.alert('✅', `Надіслано ${d.sent} повідомлень (${d.recipientsCount} учасників)`);
      setMassTarget(null);
      setMassText('');
    } catch (e: any) {
      Alert.alert('Помилка', e?.message || 'Не вдалося надіслати');
    } finally {
      setSending(false);
    }
  };

  // Fetch coach groups on mount (for calendar dots)
  useEffect(() => {
    fetchGroups();
  }, []);

  // Fetch trainings when day or month changes
  useEffect(() => {
    fetchDayTrainings();
  }, [selectedDay, currentMonth]);

  const fetchGroups = async () => {
    try {
      const res = await api.client.get('/coach/groups');
      setCoachGroups(res.data || []);
    } catch (err) {
      console.log('Failed to fetch groups:', err);
    }
  };

  const fetchDayTrainings = async () => {
    setLoadingDay(true);
    try {
      const dateStr = formatDateStr(currentMonth.getFullYear(), currentMonth.getMonth(), selectedDay);
      const res = await api.client.get(`/coach/training/by-date?date=${dateStr}`);
      const sessions = res.data?.sessions || [];
      setDayTrainings(sessions.map((s: any) => ({
        id: s.id,
        time: s.startTime,
        groupName: s.groupName,
        groupId: s.groupId,
        present: s.presentCount || 0,
        absent: s.absentCount || 0,
        total: s.totalStudents || 0,
        status: s.status === 'COMPLETED' ? 'completed'
          : s.status === 'ACTIVE' ? 'in_progress'
          : 'upcoming',
      })));
    } catch (err) {
      console.log('Failed to fetch day trainings:', err);
      setDayTrainings([]);
    } finally {
      setLoadingDay(false);
    }
  };

  // Calculate which days have trainings based on group schedules
  const getTrainingDays = (): Record<number, DayInfo> => {
    const result: Record<number, DayInfo> = {};
    const daysInM = getDaysInMonth(currentMonth);
    const dayNameMap: Record<number, string> = {
      0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT',
    };

    for (let day = 1; day <= daysInM; day++) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dayName = dayNameMap[d.getDay()];
      let count = 0;
      for (const group of coachGroups) {
        const schedItems = group.schedule || [];
        if (schedItems.some((s: any) => s.day === dayName)) {
          count++;
        }
      }
      if (count > 0) {
        result[day] = { hasTraining: true, hasProblem: false, trainingsCount: count };
      }
    }
    return result;
  };

  const trainingDays = getTrainingDays();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    await fetchDayTrainings();
    setRefreshing(false);
  }, [selectedDay, currentMonth]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    setSelectedDay(1);
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    setSelectedDay(1);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return { color: '#22C55E', icon: 'checkmark-circle', label: 'Завершено' };
      case 'in_progress':
        return { color: '#3B82F6', icon: 'time', label: 'В процесі' };
      case 'problem':
        return { color: '#EF4444', icon: 'alert-circle', label: 'Проблема' };
      case 'upcoming':
      default:
        return { color: '#6B7280', icon: 'time-outline', label: 'Очікується' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Month Header */}
        <View style={styles.monthHeader}>
          <Pressable onPress={prevMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={24} color="#0F0F10" />
          </Pressable>
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <Pressable onPress={nextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={24} color="#0F0F10" />
          </Pressable>
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarCard}>
          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day) => (
              <View key={day} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Days grid */}
          <View style={styles.daysGrid}>
            {/* Empty cells for alignment */}
            {emptyDays.map((_, index) => (
              <View key={`empty-${index}`} style={styles.dayCell} />
            ))}

            {/* Day cells */}
            {days.map((day) => {
              const isSelected = selectedDay === day;
              const isTodayDate = isToday(day);
              const dayInfo = trainingDays[day];
              const hasTraining = dayInfo?.hasTraining;
              const hasProblem = dayInfo?.hasProblem;

              return (
                <Pressable
                  key={day}
                  style={styles.dayCell}
                  onPress={() => setSelectedDay(day)}
                >
                  <View
                    style={[
                      styles.dayNumber,
                      isSelected && styles.dayNumberSelected,
                      isTodayDate && !isSelected && styles.dayNumberToday,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        isTodayDate && !isSelected && styles.dayTextToday,
                      ]}
                    >
                      {day}
                    </Text>
                  </View>
                  {hasProblem ? (
                    <Text style={styles.dayIndicatorProblem}>⚠</Text>
                  ) : hasTraining ? (
                    <Text style={styles.dayIndicator}>●</Text>
                  ) : (
                    <Text style={styles.dayIndicatorEmpty}> </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <Text style={styles.legendDot}>●</Text>
            <Text style={styles.legendText}>Тренування</Text>
          </View>
          <View style={styles.legendItem}>
            <Text style={styles.legendDotProblem}>⚠</Text>
            <Text style={styles.legendText}>Проблеми</Text>
          </View>
        </View>

        {/* Selected Day Trainings */}
        <View style={styles.daySection}>
          <Text style={styles.daySectionTitle}>
            {selectedDay} {MONTHS_GENITIVE[currentMonth.getMonth()]}
          </Text>

          {dayTrainings.length > 0 ? (
            dayTrainings.map((training) => {
              const statusInfo = getStatusInfo(training.status);
              return (
                <View key={training.id} style={styles.trainingCard} testID={`training-card-${training.id}`}>
                  <Pressable
                    style={styles.trainingCardTop}
                    onPress={() => router.push(`/coach/training/${training.id}` as any)}
                  >
                    <View style={styles.trainingLeft}>
                      <View
                        style={[styles.statusDot, { backgroundColor: statusInfo.color }]}
                      />
                      <View style={styles.trainingTime}>
                        <Text style={styles.trainingTimeText}>{training.time}</Text>
                      </View>
                    </View>
                    <View style={styles.trainingInfo}>
                      <Text style={styles.trainingName}>{training.groupName}</Text>
                      {training.status === 'completed' ? (
                        <View style={styles.trainingStatsRow}>
                          <View style={styles.statBadgeGreen}>
                            <Ionicons name="checkmark" size={12} color="#fff" />
                            <Text style={styles.statBadgeText}>{training.present}</Text>
                          </View>
                          <View style={styles.statBadgeRed}>
                            <Ionicons name="close" size={12} color="#fff" />
                            <Text style={styles.statBadgeText}>{training.absent}</Text>
                          </View>
                        </View>
                      ) : training.status === 'in_progress' ? (
                        <Text style={[styles.trainingStats, { color: '#3B82F6' }]}>
                          В процесі · {training.present}/{training.total}
                        </Text>
                      ) : (
                        <Text style={styles.trainingStats}>
                          {training.total} учнів очікується
                        </Text>
                      )}
                    </View>
                    <View style={styles.trainingRight}>
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </View>
                  </Pressable>

                  {/* Operational CTAs */}
                  <View style={styles.ctaRow}>
                    <TouchableOpacity
                      testID={`cta-group-${training.id}`}
                      style={styles.ctaBtn}
                      onPress={() => router.push(`/coach/group/${training.groupId}` as any)}
                    >
                      <Ionicons name="people" size={13} color="#3B82F6" />
                      <Text style={[styles.ctaT, { color: '#3B82F6' }]}>Група</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`cta-broadcast-${training.id}`}
                      style={styles.ctaBtn}
                      onPress={() => openMassMessage(training)}
                    >
                      <Ionicons name="megaphone" size={13} color="#7C3AED" />
                      <Text style={[styles.ctaT, { color: '#7C3AED' }]}>Написати всім</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      testID={`cta-attendance-${training.id}`}
                      style={[styles.ctaBtn, { backgroundColor: '#0F0F10' }]}
                      onPress={() => router.push(`/coach/attendance/${training.id}` as any)}
                    >
                      <Ionicons name="checkmark-done" size={13} color="#FFF" />
                      <Text style={[styles.ctaT, { color: '#FFF' }]}>Відвідування</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : loadingDay ? (
            <View style={styles.emptyDay}>
              <ActivityIndicator size="small" color="#E30613" />
            </View>
          ) : (
            <View style={styles.emptyDay}>
              <Ionicons name="calendar-outline" size={40} color="#D1D5DB" />
              <Text style={styles.emptyDayText}>Немає тренувань цього дня</Text>
              <TouchableOpacity
                testID="create-training-btn"
                style={styles.emptyCta}
                onPress={() => router.push('/coach/groups' as any)}
              >
                <Ionicons name="add-circle" size={16} color="#E30613" />
                <Text style={styles.emptyCtaT}>Мої групи</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Mass Message Modal */}
      <Modal visible={!!massTarget} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOv}
        >
          <View style={styles.modalC}>
            <View style={styles.modalH}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalT}>Написати всім</Text>
                {massTarget && (
                  <Text style={styles.modalSub}>
                    {massTarget.groupName} · {massTarget.time}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                testID="mass-close"
                onPress={() => {
                  setMassTarget(null);
                  setMassText('');
                }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.templateLbl}>Шаблони</Text>
            <View style={styles.templatesRow}>
              {[
                'Нагадую: не запізнюйтесь 💪',
                'Тренування перенесено',
                'Візьміть форму на сьогодні',
                'Змагання у суботу!',
              ].map((tpl, i) => (
                <TouchableOpacity
                  key={i}
                  testID={`tpl-${i}`}
                  style={styles.templateChip}
                  onPress={() => setMassText(tpl)}
                >
                  <Text style={styles.templateChipT} numberOfLines={1}>{tpl}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              testID="mass-input"
              style={styles.massInput}
              value={massText}
              onChangeText={setMassText}
              placeholder="Повідомлення..."
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity
              testID="mass-send"
              style={[styles.sendMassBtn, sending && { opacity: 0.6 }]}
              disabled={sending}
              onPress={sendMassMessage}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="megaphone" size={16} color="#FFF" />
                  <Text style={styles.sendMassT}>Надіслати всім</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  // Month Header
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthArrow: {
    padding: 8,
  },
  monthTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F0F10',
  },
  // Calendar
  calendarCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberSelected: {
    backgroundColor: '#0F0F10',
  },
  dayNumberToday: {
    backgroundColor: '#FEE2E2',
  },
  dayText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F10',
  },
  dayTextSelected: {
    color: '#fff',
  },
  dayTextToday: {
    color: '#E30613',
  },
  dayIndicator: {
    fontSize: 8,
    color: '#0F0F10',
    marginTop: 2,
  },
  dayIndicatorProblem: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 2,
  },
  dayIndicatorEmpty: {
    fontSize: 8,
    marginTop: 2,
  },
  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    fontSize: 10,
    color: '#0F0F10',
  },
  legendDotProblem: {
    fontSize: 12,
    color: '#EF4444',
  },
  legendText: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Day Section
  daySection: {
    marginTop: 20,
  },
  daySectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 14,
  },
  // Training Card
  trainingCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  trainingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  trainingTime: {
    backgroundColor: '#0F0F10',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  trainingTimeText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  trainingInfo: {
    flex: 1,
  },
  trainingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  trainingStats: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  trainingStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  statBadgeGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  statBadgeRed: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  statBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  trainingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  markAttendanceBtn: {
    padding: 8,
  },
  // Empty
  emptyDay: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  emptyDayText: {
    fontSize: 15,
    color: '#9CA3AF',
    marginTop: 12,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyCtaT: { color: '#E30613', fontSize: 13, fontWeight: '700' },

  // Operational CTAs row
  ctaRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  ctaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
  },
  ctaT: { fontSize: 11, fontWeight: '700' },

  // Mass message modal
  modalOv: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalC: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  modalH: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalT: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  modalSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  templateLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  templatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  templateChip: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  templateChipT: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
  massInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 100,
  },
  sendMassBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E30613',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 12,
  },
  sendMassT: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
