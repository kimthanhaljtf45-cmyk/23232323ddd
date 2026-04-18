import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

type Filter = 'all' | 'risk' | 'stable' | 'growing';

type StudentRow = {
  id: string;
  childId: string;
  name: string;
  firstName: string;
  lastName: string;
  programType: string;
  belt: string;
  attendancePct: number;
  consecutiveMisses: number;
  status: 'risk' | 'stable' | 'growing';
  riskReason?: string | null;
  trend: string;
  groupName: string;
  coachName: string;
};

const BELT_COLORS: Record<string, string> = {
  WHITE: '#F3F4F6',
  YELLOW: '#FCD34D',
  ORANGE: '#FB923C',
  GREEN: '#22C55E',
  BLUE: '#3B82F6',
  BROWN: '#92400E',
  BLACK: '#111827',
};

const STATUS_META: Record<Filter, { label: string; color: string; bg: string; icon: any }> = {
  all: { label: 'Всі', color: '#111827', bg: '#F3F4F6', icon: 'people-outline' },
  risk: { label: 'Ризик', color: '#DC2626', bg: '#FEE2E2', icon: 'warning-outline' },
  stable: { label: 'Стабільні', color: '#10B981', bg: '#DCFCE7', icon: 'checkmark-circle-outline' },
  growing: { label: 'Ростуть', color: '#3B82F6', bg: '#DBEAFE', icon: 'trending-up-outline' },
};

export default function OwnerStudentsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [counts, setCounts] = useState<{ all: number; risk: number; stable: number; growing: number }>({
    all: 0,
    risk: 0,
    stable: 0,
    growing: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudents = useCallback(async (currentFilter: Filter) => {
    try {
      const qs = currentFilter === 'all' ? '' : `?filter=${currentFilter}`;
      const res: any = await api.get(`/owner/students${qs}`);
      const data = res?.data || res;
      setStudents(data?.students || []);
      setCounts(data?.counts || { all: 0, risk: 0, stable: 0, growing: 0 });
    } catch (e) {
      console.error('Load students error:', e);
      Alert.alert('Помилка', 'Не вдалось завантажити учнів.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchStudents(filter);
    }, [filter, fetchStudents])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchStudents(filter);
  };

  const filteredBySearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.coachName.toLowerCase().includes(q));
  }, [students, search]);

  const openStudent = (childId: string) => {
    router.push(`/student/${childId}` as any);
  };

  const quickMessage = (childId: string, name: string) => {
    Alert.alert(
      `Написати батькам ${name}?`,
      'Нагадування про тренування буде надіслано миттєво.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відправити',
          onPress: async () => {
            try {
              await api.post('/owner/mass-message', {
                childIds: [childId],
                text: 'Нагадуємо: сьогодні тренування для {name}. Чекаємо на вас!',
              });
              Alert.alert('✓ Відправлено', `Повідомлення надіслане батькам ${name}.`);
            } catch {
              Alert.alert('Помилка відправки');
            }
          },
        },
      ]
    );
  };

  const quickReschedule = (childId: string, name: string) => {
    Alert.alert(
      `Перенести тренування ${name}?`,
      'Батьки отримають пропозицію обрати новий час.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Запропонувати',
          onPress: async () => {
            try {
              await api.post('/owner/mass-reschedule', {
                childIds: [childId],
                reason: 'Оберіть інший зручний час для тренування.',
              });
              Alert.alert('✓ Відправлено', `Пропозиція надіслана батькам ${name}.`);
            } catch {
              Alert.alert('Помилка');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Всі учні</Text>
          <Text style={styles.headerSubtitle}>{counts.all} у клубі</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          testID="students-search"
          style={styles.searchInput}
          placeholder="Пошук за ім'ям або тренером"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsScroll}
        contentContainerStyle={styles.chipsRow}
      >
        {(['all', 'risk', 'growing', 'stable'] as Filter[]).map((f) => {
          const meta = STATUS_META[f];
          const isActive = filter === f;
          const count = counts[f];
          return (
            <TouchableOpacity
              key={f}
              testID={`filter-${f}`}
              style={[styles.chip, isActive && { backgroundColor: meta.color, borderColor: meta.color }]}
              onPress={() => setFilter(f)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={meta.icon}
                size={14}
                color={isActive ? '#FFF' : meta.color}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.chipText, isActive && { color: '#FFF' }]}>
                {meta.label}
              </Text>
              <View style={[styles.chipBadge, isActive && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                <Text style={[styles.chipBadgeText, isActive && { color: '#FFF' }]}>{count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      ) : filteredBySearch.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="people-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>
            {search ? 'Нічого не знайдено' : 'Немає учнів у цій категорії'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />}
        >
          {filteredBySearch.map((s, idx) => {
            const statusMeta = STATUS_META[s.status] || STATUS_META.stable;
            const beltColor = BELT_COLORS[s.belt] || '#F3F4F6';
            return (
              <TouchableOpacity
                key={s.id}
                testID={`student-row-${idx}`}
                style={styles.studentCard}
                activeOpacity={0.85}
                onPress={() => openStudent(s.childId)}
              >
                <View style={styles.avatarCol}>
                  <View style={[styles.avatar, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[styles.avatarText, { color: statusMeta.color }]}>
                      {s.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={[styles.beltDot, { backgroundColor: beltColor, borderColor: s.belt === 'WHITE' ? '#D1D5DB' : beltColor }]} />
                </View>

                <View style={styles.infoCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                    <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
                      <Text style={[styles.statusPillText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.metaLine} numberOfLines={1}>
                    {s.groupName || '—'} · тренер {s.coachName || '—'}
                  </Text>
                  <View style={styles.statsRow}>
                    <View style={styles.statChip}>
                      <Ionicons name="calendar-outline" size={11} color="#6B7280" />
                      <Text style={styles.statChipText}>{s.attendancePct}%</Text>
                    </View>
                    {s.consecutiveMisses > 0 && (
                      <View style={[styles.statChip, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="warning-outline" size={11} color="#DC2626" />
                        <Text style={[styles.statChipText, { color: '#DC2626' }]}>
                          {s.consecutiveMisses} пропусків
                        </Text>
                      </View>
                    )}
                    {s.trend === 'growing' && (
                      <View style={[styles.statChip, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="trending-up" size={11} color="#3B82F6" />
                        <Text style={[styles.statChipText, { color: '#3B82F6' }]}>Росте</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.actionsCol}>
                  <TouchableOpacity
                    testID={`row-msg-${idx}`}
                    style={styles.actionIconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={(e) => { e.stopPropagation(); quickMessage(s.childId, s.name); }}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`row-resched-${idx}`}
                    style={styles.actionIconBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={(e) => { e.stopPropagation(); quickReschedule(s.childId, s.name); }}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 1 },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },

  chipsScroll: { flexGrow: 0, marginTop: 12 },
  chipsRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#111827' },
  chipBadge: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, backgroundColor: '#F3F4F6', minWidth: 20, alignItems: 'center' },
  chipBadgeText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF' },

  studentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', padding: 12, marginHorizontal: 16, marginBottom: 8, borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  avatarCol: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  beltDot: { position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#FFF' },

  infoCol: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  metaLine: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, backgroundColor: '#F3F4F6', borderRadius: 8 },
  statChipText: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  actionsCol: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionIconBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
});
