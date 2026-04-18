import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

export default function CoachProfileForParent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/parent/coach/${id}`);
      setData(res);
    } catch (e) {
      console.log('Coach profile error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { if (id) load(); }, [id]);

  if (loading || !data) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>
      </SafeAreaView>
    );
  }

  const startChat = async () => {
    try {
      const res = await api.post('/parent/chat/start', { coachId: id });
      if (res.threadId) {
        router.push(`/messages/${res.threadId}` as any);
      }
    } catch (e) {
      router.push('/messages' as any);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#E30613" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#0F172A" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Тренер</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{data.name?.charAt(0) || 'Т'}</Text>
          </View>
          <Text style={s.name}>{data.name}</Text>
          <Text style={s.spec}>{data.specialization}</Text>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statVal}>{data.experienceYears}</Text>
              <Text style={s.statLbl}>Років досвіду</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{data.studentsCount}</Text>
              <Text style={s.statLbl}>Учнів</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statItem}>
              <Text style={s.statVal}>{data.rating?.toFixed(1) || '—'}</Text>
              <Text style={s.statLbl}>Рейтинг</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity testID="coach-write-btn" style={s.primaryBtn} onPress={startChat}>
              <Ionicons name="chatbubble" size={18} color="#fff" />
              <Text style={s.primaryBtnT}>Написати</Text>
            </TouchableOpacity>
            {data.phone && (
              <TouchableOpacity testID="coach-call-btn" style={s.secondaryBtn} onPress={() => Linking.openURL(`tel:${data.phone}`)}>
                <Ionicons name="call" size={18} color="#16A34A" />
                <Text style={s.secondaryBtnT}>Зателефонувати</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Bio */}
        {data.bio ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>ПРО ТРЕНЕРА</Text>
            <View style={s.bioCard}>
              <Text style={s.bioText}>{data.bio}</Text>
            </View>
          </View>
        ) : null}

        {/* Groups */}
        {(data.groups || []).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>ГРУПИ</Text>
            {data.groups.map((g: any) => (
              <View key={g.id} style={s.groupCard}>
                <View style={s.groupIcon}><Ionicons name="people" size={18} color="#3B82F6" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.groupName}>{g.name}</Text>
                  <Text style={s.groupMeta}>{g.studentsCount} учнів</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent actions — transparency */}
        {(data.recentActions || []).length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>ОСТАННІ ДІЇ</Text>
            {data.recentActions.map((a: any, i: number) => (
              <View key={i} style={s.actionCard}>
                <View style={[s.actionIcon, a.type === 'achievement' ? { backgroundColor: '#FEF3C7' } : { backgroundColor: '#DCFCE7' }]}>
                  <Ionicons name={a.icon || 'checkmark-circle'} size={16} color={a.type === 'achievement' ? '#D97706' : '#16A34A'} />
                </View>
                <Text style={s.actionText}>{a.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* How coach works with your child */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ЯК ТРЕНЕР ПРАЦЮЄ З ВАШОЮ ДИТИНОЮ</Text>
          <View style={s.workCard}>
            {[
              { icon: 'checkmark-circle', text: 'Відмічає відвідування кожного заняття', color: '#16A34A' },
              { icon: 'trending-up', text: 'Слідкує за прогресом та розвитком', color: '#3B82F6' },
              { icon: 'chatbubble', text: 'Доступний для зворотного зв\'язку', color: '#7C3AED' },
              { icon: 'trophy', text: 'Готує до змагань та атестацій', color: '#D97706' },
            ].map((item, i) => (
              <View key={i} style={s.workRow}>
                <Ionicons name={item.icon as any} size={18} color={item.color} />
                <Text style={s.workText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 32 },
  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  // Profile card
  profileCard: { backgroundColor: '#fff', paddingVertical: 28, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { fontSize: 32, fontWeight: '800', color: '#fff' },
  name: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  spec: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  // Stats
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, backgroundColor: '#F9FAFB', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20, marginHorizontal: 20 },
  statItem: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  statLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  statDiv: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  // Actions
  actions: { flexDirection: 'row', gap: 10, marginTop: 20, paddingHorizontal: 20 },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E30613', borderRadius: 14, paddingVertical: 14 },
  primaryBtnT: { fontSize: 16, fontWeight: '700', color: '#fff' },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#DCFCE7', borderRadius: 14, paddingVertical: 14 },
  secondaryBtnT: { fontSize: 16, fontWeight: '700', color: '#16A34A' },
  // Section
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 10 },
  // Bio
  bioCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  bioText: { fontSize: 14, color: '#374151', lineHeight: 22 },
  // Groups
  groupCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  groupIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  groupMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Actions
  actionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  actionIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 13, color: '#374151', flex: 1 },
  // Work card
  workCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', gap: 14 },
  workRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workText: { fontSize: 14, color: '#374151', flex: 1 },
});
