import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

/**
 * GROUP DETAIL - Деталі групи з можливістю додавання учнів
 */

interface Student {
  id: string;
  name: string;
  belt: string;
  attendance: number;
  discipline: number;
}

interface GroupDetail {
  id: string;
  name: string;
  coach?: { id: string; name: string };
  capacity: number;
  students: Student[];
}

interface AvailableStudent {
  id: string;
  name: string;
  age?: number;
  belt: string;
}

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [availableStudents, setAvailableStudents] = useState<AvailableStudent[]>([]);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addingStudent, setAddingStudent] = useState<string | null>(null);

  // Load group detail
  const loadGroup = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [groupRes, studentsRes] = await Promise.all([
        api.get(`/admin/groups/${id}`),
        api.get('/admin/students/available'),
      ]);
      setGroup(groupRes);
      setAvailableStudents(studentsRes || []);
    } catch (error) {
      console.log('Load group error:', error);
      // Demo data
      setGroup({
        id: id || '1',
        name: 'Демо група',
        coach: { id: '1', name: 'Тренер' },
        capacity: 15,
        students: [],
      });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadGroup();
  }, [loadGroup]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadGroup();
    setRefreshing(false);
  }, [loadGroup]);

  // Add student to group
  const handleAddStudent = async (childId: string) => {
    if (!id) return;
    
    try {
      setAddingStudent(childId);
      await api.post(`/admin/groups/${id}/students`, { childId });
      
      Alert.alert('Успішно', 'Учня додано до групи');
      setShowAddStudent(false);
      loadGroup();
    } catch (error: any) {
      Alert.alert('Помилка', error?.response?.data?.message || 'Не вдалося додати учня');
    } finally {
      setAddingStudent(null);
    }
  };

  // Remove student from group
  const handleRemoveStudent = (student: Student) => {
    Alert.alert(
      'Видалити з групи?',
      `Ви впевнені, що хочете видалити ${student.name} з групи?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/groups/${id}/students/${student.id}`);
              loadGroup();
            } catch (error: any) {
              Alert.alert('Помилка', error?.response?.data?.message || 'Не вдалося видалити учня');
            }
          },
        },
      ]
    );
  };

  // Delete group
  const handleDeleteGroup = () => {
    Alert.alert(
      'Видалити групу?',
      'Ви впевнені? Ця дія незворотня.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/admin/groups/${id}`);
              Alert.alert('Успішно', 'Групу видалено');
              router.back();
            } catch (error: any) {
              Alert.alert('Помилка', error?.response?.data?.message || 'Не вдалося видалити групу');
            }
          },
        },
      ]
    );
  };

  const handleBack = () => {
    router.back();
  };

  const getBeltColor = (belt: string) => {
    const colors: Record<string, string> = {
      WHITE: '#F3F4F6',
      YELLOW: '#FEF3C7',
      ORANGE: '#FFEDD5',
      GREEN: '#D1FAE5',
      BLUE: '#DBEAFE',
      BROWN: '#E7E5E4',
      BLACK: '#1F2937',
    };
    return colors[belt] || '#F3F4F6';
  };

  const getBeltTextColor = (belt: string) => {
    return belt === 'BLACK' ? '#FFFFFF' : '#0F0F10';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      </SafeAreaView>
    );
  }

  if (!group) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <Text>Групу не знайдено</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{group.name}</Text>
        <Pressable onPress={handleDeleteGroup} style={styles.headerBtn}>
          <Ionicons name="trash-outline" size={22} color="#EF4444" />
        </Pressable>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />}
      >
        {/* Group Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="person" size={20} color="#7C3AED" />
              <Text style={styles.infoLabel}>Тренер</Text>
              <Text style={styles.infoValue}>{group.coach?.name || 'Не призначено'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="people" size={20} color="#7C3AED" />
              <Text style={styles.infoLabel}>Учнів</Text>
              <Text style={styles.infoValue}>{group.students?.length || 0} / {group.capacity}</Text>
            </View>
          </View>
        </View>

        {/* Students Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Учні групи</Text>
            <Pressable 
              style={styles.addBtn}
              onPress={() => setShowAddStudent(true)}
            >
              <Ionicons name="add" size={20} color="#7C3AED" />
              <Text style={styles.addBtnText}>Додати</Text>
            </Pressable>
          </View>

          {group.students?.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>В групі поки немає учнів</Text>
              <Pressable style={styles.emptyBtn} onPress={() => setShowAddStudent(true)}>
                <Text style={styles.emptyBtnText}>Додати першого учня</Text>
              </Pressable>
            </View>
          ) : (
            group.students?.map((student) => (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentInfo}>
                  <View style={[styles.beltBadge, { backgroundColor: getBeltColor(student.belt) }]}>
                    <Text style={[styles.beltText, { color: getBeltTextColor(student.belt) }]}>
                      {student.belt}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <View style={styles.studentStats}>
                      <Text style={styles.studentStat}>
                        <Ionicons name="checkmark-circle" size={14} color="#22C55E" /> {student.attendance}%
                      </Text>
                      <Text style={styles.studentStat}>
                        <Ionicons name="shield-checkmark" size={14} color="#3B82F6" /> {student.discipline}%
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable 
                  style={styles.removeBtn}
                  onPress={() => handleRemoveStudent(student)}
                >
                  <Ionicons name="close-circle" size={24} color="#EF4444" />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add Student Modal */}
      <Modal visible={showAddStudent} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Додати учня</Text>
              <Pressable onPress={() => setShowAddStudent(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalScroll}>
              {availableStudents.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>Немає доступних учнів</Text>
                  <Text style={styles.emptyHint}>Всі учні вже в групах</Text>
                </View>
              ) : (
                availableStudents.map((student) => (
                  <Pressable 
                    key={student.id} 
                    style={styles.availableStudent}
                    onPress={() => handleAddStudent(student.id)}
                    disabled={addingStudent === student.id}
                  >
                    <View style={[styles.beltBadge, { backgroundColor: getBeltColor(student.belt) }]}>
                      <Text style={[styles.beltText, { color: getBeltTextColor(student.belt) }]}>
                        {student.belt}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      {student.age && <Text style={styles.studentAge}>{student.age} років</Text>}
                    </View>
                    {addingStudent === student.id ? (
                      <ActivityIndicator size="small" color="#7C3AED" />
                    ) : (
                      <Ionicons name="add-circle" size={28} color="#7C3AED" />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F0F10', textAlign: 'center' },
  
  scrollView: { flex: 1 },
  
  infoCard: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 16,
    padding: 16,
  },
  infoRow: { flexDirection: 'row', gap: 16 },
  infoItem: { flex: 1, alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  
  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  emptyHint: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  emptyBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  studentInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  beltBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  beltText: { fontSize: 11, fontWeight: '700' },
  studentName: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  studentAge: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  studentStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  studentStat: { fontSize: 13, color: '#6B7280' },
  removeBtn: { padding: 8 },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F10' },
  modalScroll: { padding: 16 },
  availableStudent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
});
