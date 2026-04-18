import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

type PeopleTab = 'coaches' | 'students' | 'parents' | 'leads';
type StudentFilter = 'all' | 'risk' | 'debt' | 'inactive';

interface Coach {
  id: string;
  name: string;
  phone: string;
  groupsCount: number;
  studentsCount: number;
  score: number;
  conversionRate?: number;
  revenue?: number;
  status: string;
}

interface Student {
  id: string;
  name: string;
  belt: string;
  attendance: number;
  groupName: string;
  coachName?: string;
  debt?: number;
  riskLevel?: string;
  status?: string;
  lastVisit?: string;
}

interface Parent {
  id: string;
  name: string;
  phone: string;
  childrenCount: number;
  children: { id: string; name: string }[];
  debt: number;
  invoicesCount: number;
  ltv?: number;
}

interface Lead {
  id: string;
  fullName: string;
  phone: string;
  programType: string;
  status: string;
  priority?: string;
  assignedCoach?: string;
  createdAt: string;
}

const ACCENT = '#7C3AED';

export default function AdminPeopleScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PeopleTab>('students');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState<StudentFilter>('all');

  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState({ coaches: 0, students: 0, parents: 0, leads: 0 });

  const fetchData = useCallback(async () => {
    try {
      const [studentsRes, parentsRes, coachesRes, leadsRes] = await Promise.all([
        api.get('/admin/students').catch(() => []),
        api.get('/admin/parents').catch(() => []),
        api.get('/admin/coaches/leaderboard').catch(() => []),
        api.get('/admin/consultations').catch(() => []),
      ]);

      const studentsList: Student[] = (studentsRes || []).map((s: any) => ({
        id: s.id || s._id,
        name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        belt: s.belt || 'WHITE',
        attendance: s.attendance || 0,
        groupName: s.groupName || '',
        coachName: s.coachName || '',
        debt: s.debt || s.debtAmount || 0,
        riskLevel: s.attendance < 50 ? 'high' : s.attendance < 70 ? 'medium' : 'low',
        status: s.status || 'ACTIVE',
        lastVisit: s.lastVisit || '',
      }));
      setStudents(studentsList);

      const parentsList: Parent[] = (parentsRes || []).map((p: any) => ({
        id: p.id || p._id,
        name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        phone: p.phone || '',
        childrenCount: p.childrenCount || 0,
        children: p.children || [],
        debt: p.debt || p.totalDue || 0,
        invoicesCount: p.invoicesCount || 0,
        ltv: p.ltv || 0,
      }));
      setParents(parentsList);

      const coachesList: Coach[] = (coachesRes || []).map((c: any) => ({
        id: c.coachId || c.id || c._id,
        name: c.coachName || c.name || `${c.firstName || ''} ${c.lastName || ''}`.trim(),
        phone: c.phone || '',
        groupsCount: c.groupsCount || c.metrics?.groupsCount || 0,
        studentsCount: c.studentsCount || c.metrics?.activeStudents || 0,
        score: c.kpiScore || c.score || 0,
        conversionRate: c.conversionRate || 0,
        revenue: c.revenueInfluenced || 0,
        status: c.status || 'active',
      }));
      setCoaches(coachesList);

      const leadsList: Lead[] = (leadsRes || []).map((l: any) => ({
        id: l.id || l._id,
        fullName: l.fullName || l.name || '',
        phone: l.phone || '',
        programType: l.programType || '',
        status: l.status || 'NEW',
        priority: l.priority || 'WARM',
        assignedCoach: l.assignedCoach || '',
        createdAt: l.createdAt || '',
      }));
      setLeads(leadsList);

      setCounts({
        coaches: coachesList.length,
        students: studentsList.length,
        parents: parentsList.length,
        leads: leadsList.length,
      });
    } catch (error) {
      console.log('People data error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const filteredStudents = useMemo(() => {
    let result = students;
    if (studentFilter === 'risk') result = result.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium');
    if (studentFilter === 'debt') result = result.filter(s => (s.debt || 0) > 0);
    if (studentFilter === 'inactive') result = result.filter(s => s.attendance < 50);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(q) || s.groupName.toLowerCase().includes(q));
    }
    return result;
  }, [students, studentFilter, search]);

  const filteredCoaches = useMemo(() => {
    if (!search) return coaches;
    const q = search.toLowerCase();
    return coaches.filter(c => c.name.toLowerCase().includes(q));
  }, [coaches, search]);

  const filteredParents = useMemo(() => {
    if (!search) return parents;
    const q = search.toLowerCase();
    return parents.filter(p => p.name.toLowerCase().includes(q) || p.phone.includes(q));
  }, [parents, search]);

  const filteredLeads = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter(l => l.fullName.toLowerCase().includes(q) || l.phone.includes(q));
  }, [leads, search]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      default: return '#22C55E';
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'high': return 'Ризик';
      case 'medium': return 'Увага';
      default: return 'Норма';
    }
  };

  const getBeltColor = (belt: string) => {
    const colors: Record<string, string> = {
      WHITE: '#E5E7EB', YELLOW: '#FCD34D', ORANGE: '#FB923C',
      GREEN: '#22C55E', BLUE: '#3B82F6', BROWN: '#92400E', BLACK: '#1F2937'
    };
    return colors[belt] || '#E5E7EB';
  };

  const getPriorityColor = (p: string) => {
    switch (p) { case 'HOT': return '#EF4444'; case 'WARM': return '#F59E0B'; default: return '#6B7280'; }
  };

  const getStageLabel = (s: string) => {
    const map: Record<string, string> = {
      NEW: 'Новий', CONTACTED: 'Контакт', BOOKED_TRIAL: 'Пробне', TRIAL_DONE: 'Був', CONVERTED: 'Клієнт', LOST: 'Втрачено'
    };
    return map[s] || s;
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['bottom']}>
        <View style={s.loadingWrap}><ActivityIndicator size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  const tabs: [PeopleTab, string, string][] = [
    ['students', 'Учні', `${counts.students}`],
    ['coaches', 'Тренери', `${counts.coaches}`],
    ['parents', 'Батьки', `${counts.parents}`],
    ['leads', 'Leads', `${counts.leads}`],
  ];

  return (
    <SafeAreaView style={s.container} edges={['bottom']}>
      {/* Tabs */}
      <View style={s.tabsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsRow}>
          {tabs.map(([tab, label, count]) => (
            <Pressable
              key={tab}
              testID={`people-tab-${tab}`}
              style={[s.tab, activeTab === tab && s.tabActive]}
              onPress={() => { setActiveTab(tab); setSearch(''); setStudentFilter('all'); }}
            >
              <Text style={[s.tabLabel, activeTab === tab && s.tabLabelActive]}>{label}</Text>
              <View style={[s.tabCount, activeTab === tab && s.tabCountActive]}>
                <Text style={[s.tabCountText, activeTab === tab && s.tabCountTextActive]}>{count}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Search */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput
          testID="people-search-input"
          style={s.searchInput}
          placeholder="Пошук за ім'ям, телефоном..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></Pressable>
        )}
      </View>

      {/* Student Filters */}
      {activeTab === 'students' && (
        <View style={s.filtersRow}>
          {([['all', 'Усі'], ['risk', '⚠ Ризик'], ['debt', '💰 Борг'], ['inactive', '📉 Неактивні']] as [StudentFilter, string][]).map(([f, label]) => (
            <Pressable
              key={f}
              testID={`student-filter-${f}`}
              style={[s.filterChip, studentFilter === f && s.filterChipActive]}
              onPress={() => setStudentFilter(f)}
            >
              <Text style={[s.filterChipText, studentFilter === f && s.filterChipTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[ACCENT]} />}
      >
        {/* STUDENTS */}
        {activeTab === 'students' && filteredStudents.map((st) => (
          <Pressable
            key={st.id}
            testID={`student-card-${st.id}`}
            style={s.card}
            onPress={() => router.push(`/people/student/${st.id}` as any)}
          >
            <View style={s.cardRow}>
              <View style={[s.avatar, { backgroundColor: getBeltColor(st.belt) + '40' }]}>
                <View style={[s.beltDot, { backgroundColor: getBeltColor(st.belt) }]} />
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardName}>{st.name}</Text>
                <Text style={s.cardMeta}>{st.groupName}</Text>
              </View>
              <View style={s.cardBadges}>
                <View style={[s.riskBadge, { backgroundColor: getRiskColor(st.riskLevel || 'low') + '18' }]}>
                  <Text style={[s.riskText, { color: getRiskColor(st.riskLevel || 'low') }]}>{getRiskLabel(st.riskLevel || 'low')}</Text>
                </View>
              </View>
            </View>
            {/* Metrics row */}
            <View style={s.metricsRow}>
              <View style={s.metric}>
                <Ionicons name="fitness" size={14} color="#6B7280" />
                <Text style={s.metricText}>{st.attendance}%</Text>
              </View>
              {(st.debt || 0) > 0 && (
                <View style={s.metric}>
                  <Ionicons name="card" size={14} color="#EF4444" />
                  <Text style={[s.metricText, { color: '#EF4444' }]}>{st.debt?.toLocaleString()} ₴</Text>
                </View>
              )}
              <View style={s.metric}>
                <View style={[s.beltMini, { backgroundColor: getBeltColor(st.belt) }]} />
                <Text style={s.metricText}>{st.belt}</Text>
              </View>
            </View>
            {/* Quick Actions */}
            <View style={s.quickActions}>
              <TouchableOpacity testID={`student-msg-${st.id}`} style={s.qAction} onPress={() => router.push(`/people/student/${st.id}` as any)}>
                <Ionicons name="eye-outline" size={16} color={ACCENT} />
                <Text style={s.qActionText}>Профіль</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.qAction}>
                <Ionicons name="chatbubble-outline" size={16} color="#3B82F6" />
                <Text style={[s.qActionText, { color: '#3B82F6' }]}>Написати</Text>
              </TouchableOpacity>
              {st.riskLevel === 'high' && (
                <TouchableOpacity style={s.qAction}>
                  <Ionicons name="pricetag-outline" size={16} color="#EF4444" />
                  <Text style={[s.qActionText, { color: '#EF4444' }]}>Retention</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        ))}

        {/* COACHES */}
        {activeTab === 'coaches' && (
          <>
            {filteredCoaches.length === 0 && (
              <View style={s.emptyState}>
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                <Text style={s.emptyText}>Дані тренерів завантажуються з KPI модуля</Text>
                <Text style={s.emptySubtext}>Перезапустіть recalculate для оновлення</Text>
              </View>
            )}
            {filteredCoaches.map((c) => (
              <Pressable
                key={c.id}
                testID={`coach-card-${c.id}`}
                style={s.card}
                onPress={() => router.push(`/people/coach/${c.id}` as any)}
              >
                <View style={s.cardRow}>
                  <View style={[s.avatar, { backgroundColor: '#7C3AED20' }]}>
                    <Text style={[s.avatarLetter, { color: ACCENT }]}>{c.name[0]}</Text>
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName}>{c.name}</Text>
                    <Text style={s.cardMeta}>{c.groupsCount} груп • {c.studentsCount} учнів</Text>
                  </View>
                  <View style={[s.scoreBadge, { backgroundColor: c.score >= 80 ? '#22C55E18' : c.score >= 50 ? '#F59E0B18' : '#EF444418' }]}>
                    <Text style={[s.scoreText, { color: c.score >= 80 ? '#22C55E' : c.score >= 50 ? '#F59E0B' : '#EF4444' }]}>{c.score}</Text>
                    <Text style={s.scoreLabel}>KPI</Text>
                  </View>
                </View>
                <View style={s.metricsRow}>
                  {c.conversionRate > 0 && (
                    <View style={s.metric}>
                      <Ionicons name="trending-up" size={14} color="#22C55E" />
                      <Text style={s.metricText}>{c.conversionRate}% конв.</Text>
                    </View>
                  )}
                  {c.revenue > 0 && (
                    <View style={s.metric}>
                      <Ionicons name="cash" size={14} color="#7C3AED" />
                      <Text style={s.metricText}>{(c.revenue / 1000).toFixed(0)}K ₴</Text>
                    </View>
                  )}
                </View>
                <View style={s.quickActions}>
                  <TouchableOpacity style={s.qAction} onPress={() => router.push(`/people/coach/${c.id}` as any)}>
                    <Ionicons name="eye-outline" size={16} color={ACCENT} />
                    <Text style={s.qActionText}>Профіль</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.qAction}>
                    <Ionicons name="bar-chart-outline" size={16} color="#3B82F6" />
                    <Text style={[s.qActionText, { color: '#3B82F6' }]}>KPI</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.qAction}>
                    <Ionicons name="chatbubble-outline" size={16} color="#22C55E" />
                    <Text style={[s.qActionText, { color: '#22C55E' }]}>Написати</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {/* PARENTS */}
        {activeTab === 'parents' && filteredParents.map((p) => (
          <Pressable
            key={p.id}
            testID={`parent-card-${p.id}`}
            style={s.card}
            onPress={() => router.push(`/people/parent/${p.id}` as any)}
          >
            <View style={s.cardRow}>
              <View style={[s.avatar, { backgroundColor: '#EC489920' }]}>
                <Text style={[s.avatarLetter, { color: '#EC4899' }]}>{(p.name || '?')[0]}</Text>
              </View>
              <View style={s.cardBody}>
                <Text style={s.cardName}>{p.name || 'Невідомий'}</Text>
                <Text style={s.cardMeta}>{p.childrenCount} {p.childrenCount === 1 ? 'дитина' : 'дітей'} • {p.phone}</Text>
              </View>
              {p.debt > 0 && (
                <View style={s.debtBadge}>
                  <Text style={s.debtText}>{p.debt.toLocaleString()} ₴</Text>
                </View>
              )}
            </View>
            {p.children.length > 0 && (
              <View style={s.childrenRow}>
                {p.children.slice(0, 3).map((ch) => (
                  <View key={ch.id} style={s.childTag}>
                    <Text style={s.childTagText}>{ch.name}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={s.quickActions}>
              <TouchableOpacity style={s.qAction} onPress={() => router.push(`/people/parent/${p.id}` as any)}>
                <Ionicons name="eye-outline" size={16} color={ACCENT} />
                <Text style={s.qActionText}>Профіль</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.qAction}>
                <Ionicons name="chatbubble-outline" size={16} color="#3B82F6" />
                <Text style={[s.qActionText, { color: '#3B82F6' }]}>Написати</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.qAction}>
                <Ionicons name="receipt-outline" size={16} color="#F59E0B" />
                <Text style={[s.qActionText, { color: '#F59E0B' }]}>Рахунки</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        ))}

        {/* LEADS */}
        {activeTab === 'leads' && (
          <>
            {filteredLeads.length === 0 && (
              <View style={s.emptyState}>
                <Ionicons name="people-outline" size={48} color="#D1D5DB" />
                <Text style={s.emptyText}>Немає лідів</Text>
                <Text style={s.emptySubtext}>Ліди з'являться після заявок на пробне заняття</Text>
              </View>
            )}
            {filteredLeads.map((l) => (
              <View key={l.id} style={s.card}>
                <View style={s.cardRow}>
                  <View style={[s.avatar, { backgroundColor: getPriorityColor(l.priority || 'WARM') + '18' }]}>
                    <Text style={[s.avatarLetter, { color: getPriorityColor(l.priority || 'WARM') }]}>{(l.fullName || '?')[0]}</Text>
                  </View>
                  <View style={s.cardBody}>
                    <Text style={s.cardName}>{l.fullName}</Text>
                    <Text style={s.cardMeta}>{l.phone} • {l.programType}</Text>
                  </View>
                  <View style={[s.stageBadge, { backgroundColor: getPriorityColor(l.priority || 'WARM') + '18' }]}>
                    <Text style={[s.stageText, { color: getPriorityColor(l.priority || 'WARM') }]}>
                      {getStageLabel(l.status)}
                    </Text>
                  </View>
                </View>
                <View style={s.quickActions}>
                  <TouchableOpacity style={s.qAction}>
                    <Ionicons name="call-outline" size={16} color="#22C55E" />
                    <Text style={[s.qActionText, { color: '#22C55E' }]}>Подзвонити</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.qAction}>
                    <Ionicons name="person-add-outline" size={16} color={ACCENT} />
                    <Text style={s.qActionText}>Тренер</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.qAction}>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#3B82F6" />
                    <Text style={[s.qActionText, { color: '#3B82F6' }]}>Конвертувати</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  // Tabs
  tabsBar: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  tabsRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', gap: 6 },
  tabActive: { backgroundColor: ACCENT },
  tabLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabLabelActive: { color: '#fff' },
  tabCount: { backgroundColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 22, alignItems: 'center' },
  tabCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  tabCountText: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  tabCountTextActive: { color: '#fff' },
  // Search
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: '#0F0F10' },
  // Filters
  filtersRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#7C3AED18', borderWidth: 1, borderColor: ACCENT },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: ACCENT },
  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700' },
  beltDot: { width: 16, height: 16, borderRadius: 8 },
  cardBody: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  cardMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  cardBadges: { alignItems: 'flex-end' },
  // Risk
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  riskText: { fontSize: 11, fontWeight: '700' },
  // Metrics
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  beltMini: { width: 10, height: 10, borderRadius: 5 },
  // Quick Actions
  quickActions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  qAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F9F9FB' },
  qActionText: { fontSize: 12, fontWeight: '600', color: ACCENT },
  // Score
  scoreBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  scoreText: { fontSize: 16, fontWeight: '800' },
  scoreLabel: { fontSize: 9, fontWeight: '600', color: '#9CA3AF', marginTop: -2 },
  // Debt
  debtBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  debtText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },
  // Children
  childrenRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  childTag: { backgroundColor: '#EBF5FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  childTagText: { fontSize: 11, fontWeight: '600', color: '#2563EB' },
  // Stage
  stageBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  stageText: { fontSize: 11, fontWeight: '700' },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  emptySubtext: { fontSize: 13, color: '#D1D5DB', textAlign: 'center', paddingHorizontal: 40 },
});
