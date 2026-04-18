import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * ADMIN GROUPS - Structure Management
 * 
 * Управління структурою школи:
 * - групи
 * - тренери
 * - capacity
 * - health
 */

interface ApiGroup {
  id: string;
  name: string;
  students: number;
  attendanceRate: number;
  discipline: number;
  coach: { id: string; name: string } | null;
}

interface Group {
  id: string;
  name: string;
  branch: string;
  coach: { id: string; name: string } | string | null;
  program: string;
  studentsCount: number;
  capacity: number;
  attendance: number;
  healthScore: number;
  debt: number;
  status: 'good' | 'warning' | 'risk';
}

export default function AdminGroupsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filter, setFilter] = useState<'all' | 'risk' | 'underfilled'>('all');

  const fetchGroups = useCallback(async () => {
    try {
      const response = await api.get('/admin/groups');
      // Transform API response to match our Group interface
      const transformedGroups: Group[] = (response || []).map((g: ApiGroup) => ({
        id: g.id,
        name: g.name,
        branch: '', // API doesn't return branch yet
        coach: g.coach,
        program: '',
        studentsCount: g.students || 0,
        capacity: 15, // Default capacity
        attendance: g.attendanceRate || 0,
        healthScore: g.discipline || 0,
        debt: 0,
        status: g.discipline >= 70 ? 'good' : g.discipline >= 40 ? 'warning' : 'risk',
      }));
      setGroups(transformedGroups);
    } catch (error) {
      // Demo data
      setGroups([
        { id: '1', name: 'Позняки 18:30', branch: 'Позняки', coach: 'Олександр П.', program: 'KIDS_8_12', studentsCount: 8, capacity: 15, attendance: 78, healthScore: 65, debt: 4000, status: 'warning' },
        { id: '2', name: 'Дитяча 10:00', branch: 'Солом\'янка', coach: 'Марія І.', program: 'KIDS_4_7', studentsCount: 12, capacity: 12, attendance: 92, healthScore: 88, debt: 0, status: 'good' },
        { id: '3', name: 'Підлітки 16:00', branch: 'Позняки', coach: 'Олександр П.', program: 'KIDS_13_17', studentsCount: 5, capacity: 15, attendance: 65, healthScore: 42, debt: 8000, status: 'risk' },
        { id: '4', name: 'Самооборона', branch: 'Центр', coach: 'Віктор К.', program: 'SELF_DEFENSE', studentsCount: 14, capacity: 20, attendance: 85, healthScore: 75, debt: 2000, status: 'good' },
      ]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, [fetchGroups]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good': return '#22C55E';
      case 'warning': return '#F59E0B';
      case 'risk': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const filteredGroups = groups.filter(g => {
    if (filter === 'risk') return g.status === 'risk';
    if (filter === 'underfilled') return g.studentsCount / g.capacity < 0.6;
    return true;
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header Actions */}
      <View style={styles.headerActions}>
        <Pressable style={styles.addButton} onPress={() => router.push('/admin/group/create' as any)}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Нова група</Text>
        </Pressable>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'risk', 'underfilled'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Всі' : f === 'risk' ? 'В ризику' : 'Недозаповнені'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />}
      >
        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.length}</Text>
            <Text style={styles.statLabel}>груп</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#EF4444' }]}>{groups.filter(g => g.status === 'risk').length}</Text>
            <Text style={styles.statLabel}>в ризику</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{groups.reduce((a, g) => a + g.studentsCount, 0)}</Text>
            <Text style={styles.statLabel}>учнів</Text>
          </View>
        </View>

        {/* Groups List */}
        {filteredGroups.map((group) => (
          <Pressable key={group.id} style={styles.groupCard} onPress={() => router.push(`/admin/group/${group.id}` as any)}>
            <View style={styles.groupHeader}>
              <View>
                <Text style={styles.groupName}>{group.name}</Text>
                <Text style={styles.groupMeta}>
                  {group.branch} • {typeof group.coach === 'object' && group.coach ? group.coach.name : (group.coach || 'Немає тренера')}
                </Text>
              </View>
              <View style={[styles.healthBadge, { backgroundColor: getStatusColor(group.status) + '20' }]}>
                <Text style={[styles.healthScore, { color: getStatusColor(group.status) }]}>{group.healthScore}</Text>
              </View>
            </View>
            <View style={styles.groupStats}>
              <View style={styles.groupStat}>
                <Ionicons name="people" size={16} color="#6B7280" />
                <Text style={styles.groupStatText}>{group.studentsCount}/{group.capacity}</Text>
              </View>
              <View style={styles.groupStat}>
                <Ionicons name="checkmark-circle" size={16} color="#6B7280" />
                <Text style={styles.groupStatText}>{group.attendance}%</Text>
              </View>
              {group.debt > 0 && (
                <View style={styles.groupStat}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" />
                  <Text style={[styles.groupStatText, { color: '#EF4444' }]}>{group.debt.toLocaleString()} ₴</Text>
                </View>
              )}
            </View>
            {/* Capacity Bar */}
            <View style={styles.capacityBar}>
              <View style={[styles.capacityFill, { width: `${(group.studentsCount / group.capacity) * 100}%`, backgroundColor: getStatusColor(group.status) }]} />
            </View>
          </Pressable>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerActions: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12 },
  addButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  filters: { flexDirection: 'row', padding: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  filterText: { fontSize: 14, color: '#6B7280' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#0F0F10' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  groupCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  groupName: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  groupMeta: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  healthBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  healthScore: { fontSize: 16, fontWeight: '700' },
  groupStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  groupStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  groupStatText: { fontSize: 13, color: '#6B7280' },
  capacityBar: { height: 4, backgroundColor: '#F3F4F6', borderRadius: 2 },
  capacityFill: { height: 4, borderRadius: 2 },
});
