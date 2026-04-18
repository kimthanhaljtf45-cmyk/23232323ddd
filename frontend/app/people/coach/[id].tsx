import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

const ACCENT = '#7C3AED';

export default function CoachProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [kpiRes] = await Promise.all([
        api.get(`/admin/coaches/${id}/kpi`).catch(() => null),
      ]);
      setKpi(kpiRes);
      setData(kpiRes);
    } catch (e) {
      console.error('Load coach error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [id]);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.center}><ActivityIndicator size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  const name = kpi?.coachName || data?.name || 'Тренер';
  const score = kpi?.kpiScore || kpi?.score || 0;
  const studentsCount = kpi?.metrics?.activeStudents || 0;
  const groupsCount = kpi?.metrics?.groupsCount || 0;
  const attendanceRate = kpi?.metrics?.attendanceCompletion || 0;
  const recoveryRate = kpi?.metrics?.recoveryRate || 0;
  const revenueInfluenced = kpi?.revenueInfluenced || 0;
  const conversionRate = kpi?.conversionRate || 0;

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={st.header}>
        <TouchableOpacity testID="coach-profile-back" onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Профіль тренера</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={st.profileHeader}>
          <View style={st.avatar}>
            <Text style={st.avatarText}>{name[0]}</Text>
          </View>
          <Text style={st.profileName} testID="coach-profile-name">{name}</Text>
          <View style={[st.scoreBig, { backgroundColor: score >= 80 ? '#22C55E15' : score >= 50 ? '#F59E0B15' : '#EF444415' }]}>
            <Text style={[st.scoreBigValue, { color: score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444' }]}>{score}</Text>
            <Text style={st.scoreBigLabel}>KPI Score</Text>
          </View>
        </View>

        {/* Overview Metrics */}
        <View style={st.metricsGrid}>
          <MetricCard icon="people" label="Учні" value={`${studentsCount}`} color="#3B82F6" />
          <MetricCard icon="layers" label="Групи" value={`${groupsCount}`} color={ACCENT} />
          <MetricCard icon="fitness" label="Відвідуваність" value={`${attendanceRate}%`} color="#22C55E" />
          <MetricCard icon="trending-up" label="Конверсія" value={`${conversionRate}%`} color="#F59E0B" />
        </View>

        {/* Revenue */}
        <Section title="Фінансовий вплив">
          <View style={st.revenueCard}>
            <View style={st.revenueRow}>
              <Ionicons name="cash" size={24} color={ACCENT} />
              <View>
                <Text style={st.revenueValue}>{revenueInfluenced > 0 ? `${(revenueInfluenced / 1000).toFixed(1)}K ₴` : '—'}</Text>
                <Text style={st.revenueLabel}>Revenue influenced</Text>
              </View>
            </View>
            <View style={st.revenueRow}>
              <Ionicons name="refresh" size={24} color="#22C55E" />
              <View>
                <Text style={st.revenueValue}>{recoveryRate > 0 ? `${recoveryRate}%` : '—'}</Text>
                <Text style={st.revenueLabel}>Recovery rate</Text>
              </View>
            </View>
          </View>
        </Section>

        {/* Actions */}
        <Section title="Дії">
          <View style={st.actionsGrid}>
            <ActionBtn icon="chatbubble" label="Написати" color="#3B82F6" />
            <ActionBtn icon="bar-chart" label="KPI звіт" color={ACCENT} />
            <ActionBtn icon="gift" label="Бонус" color="#22C55E" />
            <ActionBtn icon="people" label="Учні" color="#F59E0B" />
          </View>
        </Section>

        {!data && (
          <View style={st.emptyState}>
            <Ionicons name="information-circle-outline" size={32} color="#D1D5DB" />
            <Text style={st.emptyText}>KPI тренера буде доступне після recalculate</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={st.metricCard}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[st.metricValue, { color }]}>{value}</Text>
      <Text style={st.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionBtn({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <TouchableOpacity style={[st.actionBtn, { borderColor: color + '30' }]} activeOpacity={0.7}>
      <View style={[st.actionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color} />
      </View>
      <Text style={[st.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  // Profile
  profileHeader: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#7C3AED20', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '800', color: ACCENT },
  profileName: { fontSize: 22, fontWeight: '800', color: '#0F0F10', marginTop: 12 },
  scoreBig: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, gap: 8, marginTop: 12 },
  scoreBigValue: { fontSize: 28, fontWeight: '900' },
  scoreBigLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '600' },
  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  metricCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  // Section
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 10 },
  // Revenue
  revenueCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 16 },
  revenueRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  revenueValue: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  revenueLabel: { fontSize: 12, color: '#9CA3AF' },
  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, gap: 8 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
