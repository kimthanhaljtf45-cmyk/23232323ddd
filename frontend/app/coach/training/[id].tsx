import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  TextInput,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

// Types
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  belt: string;
  attendanceRate: number;
  consecutiveAbsences: number;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  currentStatus: 'PRESENT' | 'ABSENT' | 'LATE' | null;
  currentNote: string | null;
}

interface TrainingSession {
  id: string;
  groupId: string;
  groupName: string;
  ageRange: string;
  level: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  actualStartTime?: string;
  actualEndTime?: string;
  location: { name: string; address: string } | null;
  students: Student[];
  summary: {
    total: number;
    present: number;
    absent: number;
    unmarked: number;
    attendanceRate: number;
  };
}

// Colors
const C = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  cardAlt: '#141414',
  accent: '#FF3B30',
  accentSoft: 'rgba(255,59,48,0.15)',
  green: '#34C759',
  greenSoft: 'rgba(52,199,89,0.15)',
  yellow: '#FFD60A',
  yellowSoft: 'rgba(255,214,10,0.15)',
  red: '#FF453A',
  redSoft: 'rgba(255,69,58,0.15)',
  white: '#FFFFFF',
  gray1: '#8E8E93',
  gray2: '#636366',
  gray3: '#48484A',
  gray4: '#2C2C2E',
  border: '#2C2C2E',
};

const BELT_COLORS: Record<string, string> = {
  WHITE: '#FFFFFF',
  YELLOW: '#FFD60A',
  ORANGE: '#FF9F0A',
  GREEN: '#34C759',
  BLUE: '#0A84FF',
  BROWN: '#A2845E',
  BLACK: '#1C1C1E',
};

export default function TrainingSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [markingStudent, setMarkingStudent] = useState<string | null>(null);
  const [trainingNotes, setTrainingNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);

  const fetchSession = useCallback(async () => {
    try {
      const data = await api.client.get(`/coach/training/${id}`);
      setSession(data.data);
    } catch (err: any) {
      console.log('Training session not found:', err?.response?.status);
      // Don't show error alert for 404 - just show empty state
      if (err?.response?.status !== 404) {
        // Only alert for unexpected errors
        console.error('Unexpected error:', err);
      }
      // Set session to null to show "not found" UI
      setSession(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchSession();
  };

  // Actions
  const handleStartTraining = async () => {
    setActionLoading(true);
    try {
      const res = await api.client.post(`/coach/training/${id}/start`);
      setSession(res.data);
    } catch (err: any) {
      Alert.alert('Помилка', err.response?.data?.message || 'Не вдалося почати');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinishTraining = async () => {
    Alert.alert(
      'Завершити тренування?',
      `Присутніх: ${session?.summary.present || 0} / ${session?.summary.total || 0}`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Завершити',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await api.client.post(`/coach/training/${id}/finish`);
              setSession(res.data);
            } catch (err: any) {
              Alert.alert('Помилка', err.response?.data?.message || 'Не вдалося завершити');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMarkAttendance = async (studentId: string, status: 'PRESENT' | 'ABSENT') => {
    setMarkingStudent(studentId);
    try {
      await api.client.post(`/coach/training/${id}/attendance`, { studentId, status });
      const res = await api.client.get(`/coach/training/${id}`);
      setSession(res.data);
    } catch (err) {
      console.error('Failed to mark attendance:', err);
    } finally {
      setMarkingStudent(null);
    }
  };

  const handleMarkAll = async () => {
    setActionLoading(true);
    try {
      await api.client.post(`/coach/training/${id}/attendance/all`);
      const res = await api.client.get(`/coach/training/${id}`);
      setSession(res.data);
    } catch (err) {
      Alert.alert('Помилка', 'Не вдалося відмітити всіх');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Тренування не знайдено</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isPlanned = session.status === 'PLANNED';
  const isActive = session.status === 'ACTIVE';
  const isCompleted = session.status === 'COMPLETED';

  const statusConfig = {
    PLANNED: { label: 'Заплановано', color: C.yellow, bg: C.yellowSoft, icon: 'time-outline' as const },
    ACTIVE: { label: 'Активне', color: C.green, bg: C.greenSoft, icon: 'play-circle-outline' as const },
    COMPLETED: { label: 'Завершено', color: C.gray1, bg: C.gray4, icon: 'checkmark-circle-outline' as const },
    CANCELLED: { label: 'Скасовано', color: C.red, bg: C.redSoft, icon: 'close-circle-outline' as const },
  };

  const sc = statusConfig[session.status];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack} hitSlop={{top:12,bottom:12,left:12,right:12}}>
          <Ionicons name="chevron-back" size={28} color={C.white} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{session.groupName}</Text>
          <Text style={styles.headerSub}>
            {session.startTime} – {session.endTime}
            {session.location ? ` · ${session.location.name}` : ''}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
          <Ionicons name={sc.icon} size={14} color={sc.color} />
          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* SESSION INFO CARD */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Дата</Text>
              <Text style={styles.infoValue}>{formatDate(session.date)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Вік</Text>
              <Text style={styles.infoValue}>{session.ageRange || '—'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Рівень</Text>
              <Text style={styles.infoValue}>{session.level || '—'}</Text>
            </View>
          </View>
          {session.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color={C.gray1} />
              <Text style={styles.locationText}>{session.location.address}</Text>
            </View>
          )}
        </View>

        {/* KPI PANEL */}
        <View style={styles.kpiPanel}>
          <View style={styles.kpiItem}>
            <View style={[styles.kpiDot, { backgroundColor: C.green }]} />
            <Text style={styles.kpiNumber}>{session.summary.present}</Text>
            <Text style={styles.kpiLabel}>Присутні</Text>
          </View>
          <View style={styles.kpiItem}>
            <View style={[styles.kpiDot, { backgroundColor: C.red }]} />
            <Text style={styles.kpiNumber}>{session.summary.absent}</Text>
            <Text style={styles.kpiLabel}>Відсутні</Text>
          </View>
          <View style={styles.kpiItem}>
            <View style={[styles.kpiDot, { backgroundColor: C.yellow }]} />
            <Text style={styles.kpiNumber}>{session.summary.unmarked}</Text>
            <Text style={styles.kpiLabel}>Не відмічені</Text>
          </View>
          <View style={styles.kpiItem}>
            <View style={[styles.kpiDot, { backgroundColor: C.accent }]} />
            <Text style={styles.kpiNumber}>{session.summary.attendanceRate}%</Text>
            <Text style={styles.kpiLabel}>Відвід.</Text>
          </View>
        </View>

        {/* COMPLETED SUMMARY */}
        {isCompleted && (
          <View style={styles.completedCard}>
            <View style={styles.completedHeader}>
              <Ionicons name="checkmark-circle" size={24} color={C.green} />
              <Text style={styles.completedTitle}>Тренування завершено</Text>
            </View>
            <Text style={styles.completedStat}>
              Attendance: {session.summary.present}/{session.summary.total} ({session.summary.attendanceRate}%)
            </Text>
            <View style={styles.completedActions}>
              <TouchableOpacity style={styles.completedBtn}>
                <Ionicons name="paper-plane-outline" size={16} color={C.accent} />
                <Text style={styles.completedBtnText}>Надіслати звіт</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.completedBtn}
                onPress={() => {
                  const absentStudents = session.students.filter(s => s.currentStatus === 'ABSENT');
                  if (absentStudents.length === 0) {
                    Alert.alert('Інфо', 'Немає відсутніх учнів');
                    return;
                  }
                  Alert.alert(
                    'Написати відсутнім',
                    `${absentStudents.length} відсутніх: ${absentStudents.map(s => s.firstName).join(', ')}`,
                    [
                      { text: 'Скасувати', style: 'cancel' },
                      { text: 'SMS', onPress: () => { /* SMS mock */ Alert.alert('SMS', 'Повідомлення надіслано (mock)'); } },
                    ]
                  );
                }}
              >
                <Ionicons name="chatbubble-outline" size={16} color={C.accent} />
                <Text style={styles.completedBtnText}>Написати відсутнім ({session.students.filter(s => s.currentStatus === 'ABSENT').length})</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TRAINING NOTES */}
        {(isActive || isCompleted) && (
          <View style={styles.notesCard}>
            <View style={styles.notesHeader}>
              <Ionicons name="document-text-outline" size={18} color={C.gray1} />
              <Text style={styles.notesTitle}>Нотатки до тренування</Text>
              {notesSaved && (
                <View style={styles.notesSaved}>
                  <Ionicons name="checkmark-circle" size={14} color={C.green} />
                  <Text style={styles.notesSavedText}>Збережено</Text>
                </View>
              )}
            </View>
            <TextInput
              style={styles.notesInput}
              value={trainingNotes}
              onChangeText={setTrainingNotes}
              placeholder="Додайте коментар до заняття..."
              placeholderTextColor={C.gray2}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <TouchableOpacity 
              style={styles.notesSaveBtn}
              onPress={() => {
                setNotesSaved(true);
                setTimeout(() => setNotesSaved(false), 2000);
              }}
            >
              <Text style={styles.notesSaveBtnText}>Зберегти</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STUDENTS SECTION HEADER */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Учні ({session.students.length})
          </Text>
          {(isActive || isPlanned) && session.summary.unmarked > 0 && (
            <TouchableOpacity onPress={handleMarkAll} style={styles.markAllBtn}>
              <Ionicons name="checkmark-done" size={16} color={C.green} />
              <Text style={styles.markAllText}>Всі присутні</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* STUDENT LIST */}
        {session.students.map((student) => (
          <StudentCard
            key={student.id}
            student={student}
            isActive={isActive || isPlanned}
            isMarking={markingStudent === student.id}
            onMarkPresent={() => handleMarkAttendance(student.id, 'PRESENT')}
            onMarkAbsent={() => handleMarkAttendance(student.id, 'ABSENT')}
          />
        ))}

        {session.students.length === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={48} color={C.gray2} />
            <Text style={styles.emptyText}>В цій групі ще немає учнів</Text>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>
        {isPlanned && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.green }]}
            onPress={handleStartTraining}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Ionicons name="play" size={20} color={C.white} />
                <Text style={styles.primaryBtnText}>Почати тренування</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isActive && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.accent }]}
            onPress={handleFinishTraining}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <>
                <Ionicons name="stop" size={20} color={C.white} />
                <Text style={styles.primaryBtnText}>Завершити тренування</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {isCompleted && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: C.gray3 }]}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={20} color={C.white} />
            <Text style={styles.primaryBtnText}>Повернутись</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// Student Card Component
function StudentCard({
  student,
  isActive,
  isMarking,
  onMarkPresent,
  onMarkAbsent,
}: {
  student: Student;
  isActive: boolean;
  isMarking: boolean;
  onMarkPresent: () => void;
  onMarkAbsent: () => void;
}) {
  const riskConfig = {
    HIGH: { color: C.red, bg: C.redSoft, label: 'Ризик' },
    MEDIUM: { color: C.yellow, bg: C.yellowSoft, label: 'Увага' },
    LOW: { color: C.green, bg: C.greenSoft, label: '' },
  };

  const risk = riskConfig[student.riskLevel];
  const isMarked = !!student.currentStatus;
  const isPresent = student.currentStatus === 'PRESENT' || student.currentStatus === 'LATE';
  const isAbsent = student.currentStatus === 'ABSENT';

  const beltColor = BELT_COLORS[student.belt] || C.white;

  return (
    <View style={[styles.studentCard, isMarked && styles.studentCardMarked]}>
      {/* Risk indicator bar */}
      <View style={[styles.riskBar, { backgroundColor: risk.color }]} />

      <View style={styles.studentContent}>
        {/* Top row: name + belt + attendance */}
        <View style={styles.studentTop}>
          <View style={styles.studentNameRow}>
            <View style={[styles.beltDot, { backgroundColor: beltColor, borderColor: beltColor === '#FFFFFF' ? C.gray2 : beltColor }]} />
            <Text style={styles.studentName}>
              {student.firstName} {student.lastName}
            </Text>
            {student.riskLevel !== 'LOW' && (
              <View style={[styles.riskBadge, { backgroundColor: risk.bg }]}>
                <Text style={[styles.riskBadgeText, { color: risk.color }]}>{risk.label}</Text>
              </View>
            )}
          </View>
          <View style={styles.attendanceBadge}>
            <Text style={[
              styles.attendanceText,
              { color: student.attendanceRate >= 80 ? C.green : student.attendanceRate >= 60 ? C.yellow : C.red }
            ]}>
              {student.attendanceRate}%
            </Text>
          </View>
        </View>

        {/* Consecutive absences warning */}
        {student.consecutiveAbsences >= 2 && (
          <View style={styles.warningRow}>
            <Ionicons name="warning" size={12} color={C.yellow} />
            <Text style={styles.warningText}>
              {student.consecutiveAbsences} пропуски поспіль
            </Text>
          </View>
        )}

        {/* Action buttons */}
        {isActive && !isMarking && (
          <View style={styles.studentActions}>
            <TouchableOpacity
              onPress={onMarkPresent}
              style={[
                styles.markBtn,
                isPresent ? styles.markBtnActive : styles.markBtnPresent,
              ]}
            >
              <Ionicons name="checkmark" size={18} color={isPresent ? C.white : C.green} />
              <Text style={[styles.markBtnText, { color: isPresent ? C.white : C.green }]}>
                Присутній
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onMarkAbsent}
              style={[
                styles.markBtn,
                isAbsent ? styles.markBtnAbsentActive : styles.markBtnAbsent,
              ]}
            >
              <Ionicons name="close" size={18} color={isAbsent ? C.white : C.red} />
              <Text style={[styles.markBtnText, { color: isAbsent ? C.white : C.red }]}>
                Відсутній
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isMarking && (
          <View style={styles.studentActions}>
            <ActivityIndicator size="small" color={C.accent} />
          </View>
        )}

        {/* Already marked indicator */}
        {!isActive && isMarked && (
          <View style={styles.markedIndicator}>
            <Ionicons
              name={isPresent ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={isPresent ? C.green : C.red}
            />
            <Text style={[styles.markedText, { color: isPresent ? C.green : C.red }]}>
              {isPresent ? 'Присутній' : 'Відсутній'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

// Helpers
function formatDate(dateStr: string): string {
  const months = [
    'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
    'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
  ];
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBack: { marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { color: C.white, fontSize: 18, fontWeight: '700' },
  headerSub: { color: C.gray1, fontSize: 13, marginTop: 2 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  statusText: { fontSize: 12, fontWeight: '600' },

  // Info card
  infoCard: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoItem: { alignItems: 'center', flex: 1 },
  infoLabel: { color: C.gray1, fontSize: 11, marginBottom: 4 },
  infoValue: { color: C.white, fontSize: 14, fontWeight: '600' },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.border,
    gap: 6,
  },
  locationText: { color: C.gray1, fontSize: 13 },

  // KPI Panel
  kpiPanel: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
  },
  kpiItem: { flex: 1, alignItems: 'center' },
  kpiDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  kpiNumber: { color: C.white, fontSize: 22, fontWeight: '800' },
  kpiLabel: { color: C.gray1, fontSize: 10, marginTop: 2 },

  // Completed
  completedCard: {
    backgroundColor: C.greenSoft,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(52,199,89,0.3)',
  },
  completedHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  completedTitle: { color: C.green, fontSize: 16, fontWeight: '700' },
  completedStat: { color: C.white, fontSize: 14, marginTop: 8 },
  completedActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  completedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: C.card,
    borderRadius: 8,
  },
  completedBtnText: { color: C.accent, fontSize: 13, fontWeight: '600' },

  // Training Notes
  notesCard: {
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notesTitle: { color: C.white, fontSize: 14, fontWeight: '600' },
  notesSaved: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  notesSavedText: { color: C.green, fontSize: 12, fontWeight: '600' },
  notesInput: {
    backgroundColor: C.cardAlt,
    borderRadius: 10,
    padding: 12,
    color: C.white,
    fontSize: 14,
    minHeight: 80,
    borderWidth: 1,
    borderColor: C.border,
  },
  notesSaveBtn: {
    alignSelf: 'flex-end',
    marginTop: 10,
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  notesSaveBtnText: { color: C.white, fontSize: 13, fontWeight: '600' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: { color: C.white, fontSize: 16, fontWeight: '700' },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: C.greenSoft,
    borderRadius: 8,
  },
  markAllText: { color: C.green, fontSize: 13, fontWeight: '600' },

  // Student card
  studentCard: {
    flexDirection: 'row',
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  studentCardMarked: { opacity: 0.85 },
  riskBar: { width: 4 },
  studentContent: { flex: 1, padding: 14 },
  studentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  studentNameRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 },
  beltDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
  },
  studentName: { color: C.white, fontSize: 15, fontWeight: '600' },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  riskBadgeText: { fontSize: 11, fontWeight: '600' },
  attendanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  attendanceText: { fontSize: 14, fontWeight: '700' },

  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  warningText: { color: C.yellow, fontSize: 12 },

  // Student action buttons
  studentActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  markBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  markBtnPresent: {
    borderColor: C.green,
    backgroundColor: 'transparent',
  },
  markBtnActive: {
    borderColor: C.green,
    backgroundColor: C.green,
  },
  markBtnAbsent: {
    borderColor: C.red,
    backgroundColor: 'transparent',
  },
  markBtnAbsentActive: {
    borderColor: C.red,
    backgroundColor: C.red,
  },
  markBtnText: { fontSize: 14, fontWeight: '600' },

  markedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  markedText: { fontSize: 13, fontWeight: '500' },

  // Empty
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginHorizontal: 16,
  },
  emptyText: { color: C.gray2, fontSize: 14, marginTop: 12 },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: C.white,
    fontSize: 16,
    fontWeight: '700',
  },

  errorText: { color: C.gray1, fontSize: 16 },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: C.card,
    borderRadius: 8,
  },
  backBtnText: { color: C.white, fontSize: 14 },
});
