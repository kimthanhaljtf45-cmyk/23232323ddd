import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * COACH X10 — УЧНІ (operational list)
 * Filters: Всі / Ризик / Росте / Стабільні / Upsell / Не прийде
 */

type FilterKey = 'all' | 'risk' | 'rising' | 'stable' | 'upsell' | 'not_coming';

const FILTERS: { key: FilterKey; label: string; color: string }[] = [
  { key: 'all', label: 'Всі', color: '#0F0F10' },
  { key: 'risk', label: 'Ризик', color: '#EF4444' },
  { key: 'rising', label: 'Росте', color: '#10B981' },
  { key: 'stable', label: 'Стабільні', color: '#3B82F6' },
  { key: 'upsell', label: 'Upsell', color: '#F59E0B' },
  { key: 'not_coming', label: 'Не прийде', color: '#6B7280' },
];

const STATUS_CFG: Record<string, { color: string; label: string }> = {
  risk: { color: '#EF4444', label: 'високий' },
  rising: { color: '#10B981', label: 'низький' },
  stable: { color: '#3B82F6', label: 'середній' },
};

function StudentRow({
  s,
  onOpen,
  onWrite,
  onReschedule,
}: {
  s: any;
  onOpen: () => void;
  onWrite: () => void;
  onReschedule: () => void;
}) {
  const status = STATUS_CFG[s.status] || STATUS_CFG.stable;
  return (
    <View style={st.card} testID={`student-${s.id}`}>
      <TouchableOpacity style={st.cardTop} onPress={onOpen} activeOpacity={0.7}>
        <View style={[st.avatar, { backgroundColor: status.color }]}>
          <Text style={st.avatarT}>{s.name?.[0]?.toUpperCase() || '?'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={st.name}>{s.name}</Text>
          <Text style={st.sub}>
            {s.group || '—'} · {s.type === 'ADULT' ? 'Дорослий' : 'Junior'}
          </Text>
          <View style={st.metaRow}>
            <View style={st.meta}>
              <Ionicons name="checkmark-circle" size={12} color="#6B7280" />
              <Text style={st.metaT}>Відвідуваність: {s.attendanceRate}%</Text>
            </View>
            <View style={st.meta}>
              <Ionicons name="flame" size={12} color="#F59E0B" />
              <Text style={st.metaT}>Серія: {s.streak || 0}</Text>
            </View>
          </View>
          <Text style={[st.riskLine, { color: status.color }]}>
            Ризик: {status.label}
          </Text>
        </View>
      </TouchableOpacity>
      <View style={st.actions}>
        <TouchableOpacity testID={`open-${s.id}`} style={st.actBtn} onPress={onOpen}>
          <Ionicons name="person" size={13} color="#7C3AED" />
          <Text style={st.actBtnT}>Профіль</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`write-${s.id}`} style={st.actBtn} onPress={onWrite}>
          <Ionicons name="chatbubble-ellipses" size={13} color="#7C3AED" />
          <Text style={st.actBtnT}>Написати</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`reschedule-${s.id}`}
          style={st.actBtn}
          onPress={onReschedule}
        >
          <Ionicons name="calendar" size={13} color="#3B82F6" />
          <Text style={[st.actBtnT, { color: '#3B82F6' }]}>Перенести</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CoachStudents() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [writeTarget, setWriteTarget] = useState<any>(null);
  const [msg, setMsg] = useState('');

  const fetchData = async () => {
    try {
      const r = await api.get('/coach/panel');
      setData(r.data || r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const sendMessage = async () => {
    if (!msg.trim() || !writeTarget) return;
    try {
      await api.post('/student/coach-message', {
        text: msg,
        toStudentId: writeTarget.id,
      });
      Alert.alert('✅', `Надіслано ${writeTarget.name}`);
      setWriteTarget(null);
      setMsg('');
    } catch {
      Alert.alert('Помилка');
    }
  };

  if (loading)
    return (
      <View style={st.center}>
        <ActivityIndicator size="large" color="#E30613" />
      </View>
    );

  const all = data?.allStudents || [];
  const notComingIds = new Set(
    (data?.needsReaction || [])
      .filter((r: any) => r.type === 'not_coming')
      .map((r: any) => r.id),
  );
  const upsellIds = new Set((data?.upsellReady || []).map((u: any) => u.id));

  const getFiltered = () => {
    let list = all;
    if (filter === 'risk') list = all.filter((s: any) => s.status === 'risk');
    else if (filter === 'rising') list = all.filter((s: any) => s.status === 'rising');
    else if (filter === 'stable') list = all.filter((s: any) => s.status === 'stable');
    else if (filter === 'upsell') list = all.filter((s: any) => upsellIds.has(s.id));
    else if (filter === 'not_coming') list = all.filter((s: any) => notComingIds.has(s.id));

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s: any) => (s.name || '').toLowerCase().includes(q));
    }
    return list;
  };

  const filtered = getFiltered();

  const getCount = (key: FilterKey): number => {
    if (key === 'all') return all.length;
    if (key === 'risk') return all.filter((s: any) => s.status === 'risk').length;
    if (key === 'rising') return all.filter((s: any) => s.status === 'rising').length;
    if (key === 'stable') return all.filter((s: any) => s.status === 'stable').length;
    if (key === 'upsell') return upsellIds.size;
    if (key === 'not_coming') return notComingIds.size;
    return 0;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Search bar */}
      <View style={st.searchBar}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          testID="students-search"
          style={st.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Пошук за ім'ям"
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={st.tabs}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            testID={`filter-${f.key}`}
            style={[st.tab, filter === f.key && st.tabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[st.tabT, filter === f.key && st.tabTActive]}>{f.label}</Text>
            <Text style={[st.tabCount, filter === f.key && st.tabCountActive]}>
              {getCount(f.key)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1, paddingHorizontal: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor="#E30613"
          />
        }
      >
        {filtered.length === 0 ? (
          <View style={st.emptyBox}>
            <Ionicons name="people-outline" size={40} color="#D1D5DB" />
            <Text style={st.emptyT}>Немає учнів у цій категорії</Text>
          </View>
        ) : (
          filtered.map((s: any) => (
            <StudentRow
              key={s.id}
              s={s}
              onOpen={() => router.push(`/coach/student/${s.id}`)}
              onWrite={() => setWriteTarget(s)}
              onReschedule={() =>
                Alert.alert('Перенести', `Оберіть новий час для ${s.name}`, [
                  {
                    text: 'До Розкладу',
                    onPress: () => router.push('/(coach)/schedule'),
                  },
                  { text: 'Скасувати', style: 'cancel' },
                ])
              }
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Write Modal */}
      <Modal visible={!!writeTarget} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={st.modalOv}
        >
          <View style={st.modalC}>
            <View style={st.modalH}>
              <Text style={st.modalT}>Написати {writeTarget?.name}</Text>
              <TouchableOpacity
                onPress={() => {
                  setWriteTarget(null);
                  setMsg('');
                }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="students-msg"
              style={st.msgInput}
              value={msg}
              onChangeText={setMsg}
              placeholder="Повідомлення..."
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity testID="students-send" style={st.sendBtn} onPress={sendMessage}>
              <Ionicons name="send" size={16} color="#FFF" />
              <Text style={st.sendT}>Надіслати</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0F0F10', paddingVertical: 12 },
  tabs: { marginTop: 12, maxHeight: 42, flexGrow: 0 },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFF',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabActive: { backgroundColor: '#0F0F10', borderColor: '#0F0F10' },
  tabT: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  tabTActive: { color: '#FFF' },
  tabCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabCountActive: { color: '#E30613', backgroundColor: '#374151' },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  cardTop: { flexDirection: 'row' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarT: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  name: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaT: { fontSize: 12, color: '#6B7280' },
  riskLine: { fontSize: 12, fontWeight: '700', marginTop: 4 },

  actions: { flexDirection: 'row', gap: 6, marginTop: 12 },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actBtnT: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },

  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyT: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },

  modalOv: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalC: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalH: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalT: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  msgInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 80,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E30613',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  sendT: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
