import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

type Lead = {
  _id: string;
  fullName: string;
  phone: string;
  programType?: string;
  status: string;
  source?: string;
  childName?: string;
  createdAt: string;
};

const STAGES: { key: string; label: string; color: string }[] = [
  { key: 'NEW', label: 'Нові', color: '#3B82F6' },
  { key: 'CONTACTED', label: "Зв'язок", color: '#F59E0B' },
  { key: 'BOOKED_TRIAL', label: 'Пробне', color: '#8B5CF6' },
  { key: 'CONVERTED', label: 'Клієнт', color: '#22C55E' },
  { key: 'LOST', label: 'Втрачено', color: '#EF4444' },
];

const stageColor = (s: string) => STAGES.find(x => x.key === s)?.color || '#6B7280';
const stageLabel = (s: string) => STAGES.find(x => x.key === s)?.label || s;

const SOURCE_ICONS: Record<string, string> = {
  INSTAGRAM: 'logo-instagram',
  SITE: 'globe-outline',
  QR: 'qr-code-outline',
  REFERRAL: 'people-outline',
};

const formatDate = (d: string) => {
  try {
    const date = new Date(d);
    const day = date.getDate();
    const months = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
    return `${day} ${months[date.getMonth()]}`;
  } catch { return ''; }
};

// Compact filter pill
const FilterPill = ({ label, count, active, color, onPress }: any) => (
  <TouchableOpacity
    testID={`filter-${label}`}
    onPress={onPress}
    style={[
      styles.pill,
      active && { backgroundColor: color || '#0F0F10' },
    ]}
    activeOpacity={0.7}
  >
    <Text style={[styles.pillText, active && styles.pillTextActive]}>
      {label}
    </Text>
    <View style={[styles.pillCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
      <Text style={[styles.pillCountText, active && { color: '#fff' }]}>{count}</Text>
    </View>
  </TouchableOpacity>
);

// Compact lead card
const LeadCard = ({ lead, onCall, onStatusChange }: { lead: Lead; onCall: () => void; onStatusChange: (s: string) => void }) => {
  const color = stageColor(lead.status);
  const nextStage = getNextStage(lead.status);

  return (
    <View style={styles.card} testID={`lead-card-${lead._id}`}>
      {/* Row 1: Name + Status */}
      <View style={styles.cardRow}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName} numberOfLines={1}>{lead.fullName}</Text>
          {lead.childName && (
            <Text style={styles.cardChild} numberOfLines={1}>{lead.childName}</Text>
          )}
        </View>
        <View style={[styles.statusChip, { backgroundColor: color + '15' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusLabel, { color }]}>{stageLabel(lead.status)}</Text>
        </View>
      </View>

      {/* Row 2: Phone + Program + Date + Source */}
      <View style={styles.cardMeta}>
        <Text style={styles.metaPhone}>{lead.phone}</Text>
        <View style={styles.metaTags}>
          {lead.programType && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{lead.programType}</Text>
            </View>
          )}
          {lead.source && SOURCE_ICONS[lead.source] && (
            <Ionicons name={SOURCE_ICONS[lead.source] as any} size={13} color="#9CA3AF" />
          )}
          <Text style={styles.metaDate}>{formatDate(lead.createdAt)}</Text>
        </View>
      </View>

      {/* Row 3: Actions — compact inline */}
      <View style={styles.cardActions}>
        <TouchableOpacity testID={`call-${lead._id}`} style={styles.actionBtn} onPress={onCall}>
          <Ionicons name="call" size={15} color="#3B82F6" />
        </TouchableOpacity>

        {nextStage && (
          <TouchableOpacity
            testID={`next-stage-${lead._id}`}
            style={[styles.actionBtnPrimary, { backgroundColor: stageColor(nextStage.key) + '15' }]}
            onPress={() => onStatusChange(nextStage.key)}
          >
            <Ionicons name="arrow-forward" size={13} color={stageColor(nextStage.key)} />
            <Text style={[styles.actionBtnText, { color: stageColor(nextStage.key) }]}>{nextStage.label}</Text>
          </TouchableOpacity>
        )}

        {lead.status !== 'CONVERTED' && lead.status !== 'LOST' && (
          <TouchableOpacity
            testID={`convert-${lead._id}`}
            style={[styles.actionBtnPrimary, { backgroundColor: '#DCFCE7' }]}
            onPress={() => onStatusChange('CONVERTED')}
          >
            <Ionicons name="checkmark" size={13} color="#16A34A" />
            <Text style={[styles.actionBtnText, { color: '#16A34A' }]}>Клієнт</Text>
          </TouchableOpacity>
        )}

        {lead.status !== 'LOST' && lead.status !== 'CONVERTED' && (
          <TouchableOpacity
            testID={`lost-${lead._id}`}
            style={styles.actionBtn}
            onPress={() => onStatusChange('LOST')}
          >
            <Ionicons name="close" size={15} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

function getNextStage(current: string) {
  const flow: Record<string, { key: string; label: string }> = {
    NEW: { key: 'CONTACTED', label: "Зв'язок" },
    CONTACTED: { key: 'BOOKED_TRIAL', label: 'Пробне' },
    BOOKED_TRIAL: { key: 'TRIAL_DONE', label: 'Пройшло' },
    TRIAL_DONE: { key: 'CONVERTED', label: 'Клієнт' },
  };
  return flow[current] || null;
}

export default function AdminLeadsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('all');

  const { data: leads, isLoading, refetch } = useQuery({
    queryKey: ['admin-leads'],
    queryFn: () => api.get('/admin/consultations'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/consultations/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-leads'] }),
  });

  const handleStatusChange = (lead: Lead, newStatus: string) => {
    Alert.alert(
      'Змінити статус?',
      `${lead.fullName} → ${stageLabel(newStatus)}`,
      [
        { text: 'Ні', style: 'cancel' },
        { text: 'Так', onPress: () => updateMutation.mutate({ id: lead._id, status: newStatus }) },
      ],
    );
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const filtered = (leads || []).filter((l: Lead) => filter === 'all' || l.status === filter);
  const count = (s: string) => (leads || []).filter((l: Lead) => l.status === s).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leads</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{leads?.length || 0}</Text>
        </View>
      </View>

      {/* Compact Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillRow}
        style={styles.pillScroll}
      >
        <FilterPill label="Всі" count={leads?.length || 0} active={filter === 'all'} onPress={() => setFilter('all')} />
        {STAGES.map(s => (
          <FilterPill key={s.key} label={s.label} count={count(s.key)} active={filter === s.key} color={s.color} onPress={() => setFilter(s.key)} />
        ))}
      </ScrollView>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {filtered.map((lead: Lead) => (
          <LeadCard
            key={lead._id}
            lead={lead}
            onCall={() => handleCall(lead.phone)}
            onStatusChange={(s) => handleStatusChange(lead, s)}
          />
        ))}

        {filtered.length === 0 && !isLoading && (
          <View style={styles.empty}>
            <Ionicons name="funnel-outline" size={36} color="#D1D5DB" />
            <Text style={styles.emptyText}>Немає leads</Text>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  headerRight: { width: 36, alignItems: 'center' },
  headerCount: { fontSize: 14, fontWeight: '700', color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },

  // Filters
  pillScroll: { backgroundColor: '#fff', maxHeight: 48 },
  pillRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F3F4F6', gap: 5 },
  pillText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  pillTextActive: { color: '#fff' },
  pillCount: { backgroundColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  pillCountText: { fontSize: 10, fontWeight: '700', color: '#6B7280' },

  // List
  list: { flex: 1 },
  listContent: { padding: 12, gap: 8 },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 8 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: 8 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111' },
  cardChild: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  // Status chip
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: '600' },

  // Meta
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaPhone: { fontSize: 13, color: '#6B7280' },
  metaTags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  metaDate: { fontSize: 11, color: '#9CA3AF' },

  // Actions
  cardActions: { flexDirection: 'row', gap: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionBtn: { width: 32, height: 28, borderRadius: 6, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  actionBtnPrimary: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 28, borderRadius: 6, gap: 4 },
  actionBtnText: { fontSize: 11, fontWeight: '600' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
});
