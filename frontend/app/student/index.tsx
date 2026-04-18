import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

const BELT_COLORS: Record<string, string> = { WHITE: '#F5F5F5', YELLOW: '#FBBF24', ORANGE: '#FB923C', GREEN: '#22C55E', BLUE: '#3B82F6', BROWN: '#92400E', BLACK: '#18181B' };
const BELT_NAMES: Record<string, string> = { WHITE: 'Білий', YELLOW: 'Жовтий', ORANGE: 'Помаранчевий', GREEN: 'Зелений', BLUE: 'Синій', BROWN: 'Коричневий', BLACK: 'Чорний' };
const WEEKDAYS: Record<string, string> = { MONDAY: 'Пн', TUESDAY: 'Вт', WEDNESDAY: 'Ср', THURSDAY: 'Чт', FRIDAY: 'Пт', SATURDAY: 'Сб', SUNDAY: 'Нд' };

export default function StudentDashboardScreen() {
  const router = useRouter();
  const { data: dash, isLoading, refetch } = useQuery({ queryKey: ['student-dashboard'], queryFn: () => api.get('/student/dashboard') });
  const { data: schedule = [] } = useQuery({ queryKey: ['student-schedule'], queryFn: () => api.get('/student/schedule') });
  const { data: progress } = useQuery({ queryKey: ['student-progress'], queryFn: () => api.get('/student/progress') });
  const { data: attendance } = useQuery({ queryKey: ['student-attendance'], queryFn: () => api.get('/student/attendance') });
  const { data: finance } = useQuery({ queryKey: ['student-finance'], queryFn: () => api.get('/student/finance') });

  if (isLoading) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#DC2626" /></View>;

  const beltColor = BELT_COLORS[dash?.belt || 'WHITE'] || '#F5F5F5';
  const beltName = BELT_NAMES[dash?.belt || 'WHITE'] || 'Білий';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#DC2626" />}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{(dash?.name || 'У')[0]}</Text>
          </View>
          <Text style={styles.heroName} testID="student-name">{dash?.name || 'Учень'}</Text>
          <View style={styles.beltRow}>
            <View style={[styles.beltDot, { backgroundColor: beltColor, borderWidth: dash?.belt === 'WHITE' ? 1 : 0, borderColor: '#A1A1AA' }]} />
            <Text style={styles.beltText}>{beltName} пояс</Text>
          </View>
          {dash?.coachName ? <Text style={styles.coachText}>Тренер: {dash.coachName}</Text> : null}
          {dash?.groupName ? <Text style={styles.groupText}>{dash.groupName}</Text> : null}
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <Text style={styles.statValue}>{dash?.attendanceRate || 0}%</Text>
            <Text style={styles.statLabel}>Відвідуваність</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trending-up" size={22} color="#3B82F6" />
            <Text style={styles.statValue}>{progress?.progressPercent || 0}%</Text>
            <Text style={styles.statLabel}>Прогрес</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={22} color="#F59E0B" />
            <Text style={styles.statValue}>{attendance?.present || 0}</Text>
            <Text style={styles.statLabel}>Тренувань</Text>
          </View>
        </View>

        {/* Next Training */}
        {dash?.nextTraining && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Наступне заняття</Text>
            <View style={styles.nextTrainingCard}>
              <Ionicons name="calendar" size={24} color="#DC2626" />
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.nextDate}>{dash.nextTraining.date}</Text>
                <Text style={styles.nextTime}>{dash.nextTraining.startTime} — {dash.nextTraining.endTime}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Прогрес до наступного поясу</Text>
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <View style={[styles.beltSmall, { backgroundColor: beltColor }]} />
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(progress?.progressPercent || 0, 100)}%` }]} />
              </View>
              <View style={[styles.beltSmall, { backgroundColor: BELT_COLORS[progress?.nextBelt || 'YELLOW'] || '#FBBF24' }]} />
            </View>
            <Text style={styles.progressText}>{progress?.progressPercent || 0}% до {BELT_NAMES[progress?.nextBelt || 'YELLOW'] || 'Жовтого'}</Text>
            {progress?.isReadyForExam && <Text style={styles.examReady}>🎯 Готовий до атестації!</Text>}
          </View>
        </View>

        {/* Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Розклад</Text>
          {schedule.length > 0 ? schedule.slice(0, 5).map((s: any, i: number) => (
            <View key={i} style={styles.scheduleRow}>
              <View style={styles.schedDayBox}>
                <Text style={styles.schedDay}>{WEEKDAYS[s.dayOfWeek] || s.date?.substring(5, 10)}</Text>
              </View>
              <Text style={styles.schedDate}>{s.date}</Text>
              <Text style={styles.schedTime}>{s.startTime}–{s.endTime}</Text>
            </View>
          )) : <Text style={styles.emptyText}>Розклад не знайдено</Text>}
        </View>

        {/* Attendance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Відвідуваність</Text>
          {attendance && attendance.records?.length > 0 ? (
            <>
              <View style={styles.attendGrid}>
                {attendance.records.slice(0, 12).map((r: any, i: number) => (
                  <View key={i} style={[styles.attendDot, { backgroundColor: r.status === 'PRESENT' ? '#16A34A' : r.status === 'ABSENT' ? '#EF4444' : '#F59E0B' }]}>
                    <Text style={styles.attendDotText}>{r.status === 'PRESENT' ? '✓' : '✗'}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.attendRate}>{attendance.rate}% ({attendance.present}/{attendance.total})</Text>
            </>
          ) : <Text style={styles.emptyText}>Ще немає записів</Text>}
        </View>

        {/* Finance */}
        {finance && finance.debt > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Фінанси</Text>
            <View style={styles.debtCard}>
              <Ionicons name="alert-circle" size={24} color="#EF4444" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.debtLabel}>Борг</Text>
                <Text style={styles.debtAmount}>{finance.debt.toLocaleString()} ₴</Text>
              </View>
              <TouchableOpacity testID="go-to-payments-btn" style={styles.payBtn} onPress={() => router.push('/payments' as any)}>
                <Text style={styles.payBtnText}>Оплатити</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity testID="go-to-messages-btn" style={styles.actionBtn} onPress={() => router.push('/messages' as any)}>
            <Ionicons name="chatbubble-ellipses" size={22} color="#DC2626" />
            <Text style={styles.actionText}>Чат</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="go-to-competitions-btn" style={styles.actionBtn} onPress={() => router.push('/competitions' as any)}>
            <Ionicons name="trophy" size={22} color="#F59E0B" />
            <Text style={styles.actionText}>Змагання</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="go-to-profile-btn" style={styles.actionBtn} onPress={() => router.push('/profile' as any)}>
            <Ionicons name="person" size={22} color="#3B82F6" />
            <Text style={styles.actionText}>Профіль</Text>
          </TouchableOpacity>
        </View>
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090B' },
  hero: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#FFF' },
  heroName: { fontSize: 22, fontWeight: '700', color: '#FAFAFA' },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  beltDot: { width: 16, height: 16, borderRadius: 8 },
  beltText: { fontSize: 14, color: '#A1A1AA', fontWeight: '600' },
  coachText: { fontSize: 13, color: '#71717A', marginTop: 4 },
  groupText: { fontSize: 12, color: '#52525B', marginTop: 2 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#18181B', borderRadius: 12, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FAFAFA' },
  statLabel: { fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#FAFAFA', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  nextTrainingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: '#DC2626' },
  nextDate: { fontSize: 16, fontWeight: '700', color: '#FAFAFA' },
  nextTime: { fontSize: 13, color: '#A1A1AA', marginTop: 2 },
  progressCard: { backgroundColor: '#18181B', borderRadius: 12, padding: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  beltSmall: { width: 20, height: 20, borderRadius: 10 },
  progressBarBg: { flex: 1, height: 8, backgroundColor: '#27272A', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#DC2626', borderRadius: 4 },
  progressText: { fontSize: 12, color: '#A1A1AA', marginTop: 8, textAlign: 'center' },
  examReady: { fontSize: 14, color: '#16A34A', fontWeight: '700', marginTop: 6, textAlign: 'center' },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 10, padding: 12, marginBottom: 6, gap: 12 },
  schedDayBox: { backgroundColor: '#DC262620', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  schedDay: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  schedDate: { fontSize: 14, color: '#FAFAFA', fontWeight: '500', flex: 1 },
  schedTime: { fontSize: 13, color: '#A1A1AA' },
  attendGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  attendDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  attendDotText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  attendRate: { fontSize: 14, color: '#A1A1AA', fontWeight: '600' },
  debtCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 12, padding: 16, borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  debtLabel: { fontSize: 12, color: '#A1A1AA' },
  debtAmount: { fontSize: 18, fontWeight: '800', color: '#EF4444' },
  payBtn: { backgroundColor: '#DC2626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  payBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, backgroundColor: '#18181B', borderRadius: 12, padding: 16, alignItems: 'center', gap: 6 },
  actionText: { fontSize: 12, color: '#A1A1AA', fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#52525B', textAlign: 'center', paddingVertical: 16 },
});
