import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

const BELT_NAMES: Record<string, string> = { WHITE: 'Білий', YELLOW: 'Жовтий', ORANGE: 'Помаранчевий', GREEN: 'Зелений', BLUE: 'Синій', BROWN: 'Коричневий', BLACK: 'Чорний' };
const BELT_COLORS: Record<string, string> = { WHITE: '#F3F4F6', YELLOW: '#FDE68A', ORANGE: '#FDBA74', GREEN: '#86EFAC', BLUE: '#93C5FD', BROWN: '#D2B48C', BLACK: '#374151' };
const BELT_ORDER = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'];

// ── Streak Card ─────────────────────────────────────
function StreakCard({ streak, onFreeze }: { streak: any; onFreeze: (childId: string) => void }) {
  const s = streak.currentStreak;
  const fireLevel = s >= 10 ? 3 : s >= 5 ? 2 : s >= 1 ? 1 : 0;
  const fireEmoji = fireLevel === 3 ? '🏆' : fireLevel === 2 ? '🔥' : fireLevel === 1 ? '💪' : '❄️';
  const streakColor = fireLevel === 3 ? '#D97706' : fireLevel === 2 ? '#DC2626' : fireLevel === 1 ? '#16A34A' : '#9CA3AF';
  const bgColor = fireLevel === 3 ? '#FEF3C7' : fireLevel === 2 ? '#FEE2E2' : fireLevel === 1 ? '#F0FDF4' : '#F9FAFB';

  return (
    <View testID={`streak-card-${streak.childId}`} style={[st.streakCard, { borderColor: streakColor + '40' }]}>
      <View style={st.streakTop}>
        <View style={[st.streakIconWrap, { backgroundColor: bgColor }]}>
          <Text style={st.streakEmoji}>{fireEmoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.streakName}>{streak.childName}</Text>
          <Text style={st.streakLabel}>Серія тренувань</Text>
        </View>
        <View style={[st.streakNum, { backgroundColor: bgColor }]}>
          <Text style={[st.streakNumT, { color: streakColor }]}>{s}</Text>
        </View>
      </View>

      {/* Best streak */}
      <View style={st.streakMeta}>
        <Text style={st.streakMetaT}>Найкраща серія: {streak.bestStreak}</Text>
      </View>

      {/* Freeze */}
      <View style={st.freezeRow}>
        <Ionicons name="snow" size={16} color="#3B82F6" />
        <Text style={st.freezeText}>Freeze: {streak.freezesAvailable} доступно</Text>
        {streak.freezesAvailable > 0 && s > 0 && (
          <TouchableOpacity testID={`freeze-btn-${streak.childId}`} style={st.freezeBtn} onPress={() => onFreeze(streak.childId)}>
            <Text style={st.freezeBtnT}>Використати</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Streak milestones */}
      <View style={st.milestones}>
        {[3, 5, 10, 20].map(m => (
          <View key={m} style={[st.milestone, s >= m && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
            <Text style={[st.milestoneT, s >= m && { color: '#92400E' }]}>{m}</Text>
            {s >= m && <Ionicons name="checkmark" size={10} color="#D97706" />}
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Challenge Card ──────────────────────────────────
function ChallengeCard({ challenge }: { challenge: any }) {
  const isComplete = challenge.status === 'COMPLETED';
  const pct = challenge.percent;

  return (
    <View testID={`challenge-card-${challenge.childId}`} style={[st.challengeCard, isComplete && { borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }]}>
      <View style={st.challengeTop}>
        <View style={[st.challengeIcon, isComplete ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#DBEAFE' }]}>
          <Ionicons name={isComplete ? 'checkmark-circle' : 'barbell'} size={20} color={isComplete ? '#16A34A' : '#2563EB'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.challengeTitle}>{challenge.childName}</Text>
          <Text style={st.challengeDesc}>{challenge.description}</Text>
        </View>
        {!isComplete && <Text style={st.challengeDays}>{challenge.daysLeft}д</Text>}
        {isComplete && <Ionicons name="ribbon" size={24} color="#D97706" />}
      </View>

      {/* Progress bar */}
      <View style={st.progressBarBg}>
        <View style={[st.progressBarFill, { width: `${pct}%`, backgroundColor: isComplete ? '#16A34A' : '#3B82F6' }]} />
      </View>
      <View style={st.progressLabels}>
        <Text style={st.progressText}>{challenge.current}/{challenge.target}</Text>
        <Text style={st.progressReward}>{isComplete ? '✅ Виконано!' : challenge.reward}</Text>
      </View>
    </View>
  );
}

// ── Offer Card ──────────────────────────────────────
function OfferCard({ offer, onAccept }: { offer: any; onAccept: (id: string) => void }) {
  const hoursLeft = Math.round(offer.hoursLeft);
  const isUrgent = hoursLeft <= 12;

  return (
    <View testID={`offer-card-${offer.id}`} style={[st.offerCard, isUrgent && { borderColor: '#FECACA' }]}>
      <View style={st.offerTop}>
        <View style={st.offerBadge}>
          <Text style={st.offerBadgeT}>-{offer.percent}%</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.offerChild}>{offer.childName}</Text>
          <Text style={st.offerMsg}>{offer.message}</Text>
        </View>
      </View>

      {/* Timer */}
      <View style={[st.offerTimer, isUrgent && { backgroundColor: '#FEF2F2' }]}>
        <Ionicons name="time" size={14} color={isUrgent ? '#DC2626' : '#6B7280'} />
        <Text style={[st.offerTimerT, isUrgent && { color: '#DC2626', fontWeight: '700' }]}>
          {isUrgent ? `⏳ Залишилось ${hoursLeft} год!` : `Дійсно ще ${hoursLeft} год`}
        </Text>
      </View>

      <TouchableOpacity testID={`accept-offer-${offer.id}`} style={st.offerBtn} onPress={() => onAccept(offer.id)}>
        <Ionicons name="checkmark-circle" size={18} color="#fff" />
        <Text style={st.offerBtnT}>Активувати знижку</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Progress Screen ────────────────────────────
export default function ProgressScreen() {
  const { user } = useStore();
  const router = useRouter();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [progress, setProgress] = useState<any>(null);
  const [streaks, setStreaks] = useState<any[]>([]);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [homeRes, streaksRes, challengesRes, offersRes] = await Promise.all([
        api.get('/parent/home'),
        api.get('/parent/streaks').catch(() => ({ streaks: [] })),
        api.get('/parent/challenges').catch(() => ({ challenges: [] })),
        api.get('/parent/offers').catch(() => ({ offers: [] })),
      ]);
      const kids = homeRes?.children || [];
      setChildren(kids);
      setStreaks(streaksRes?.streaks || []);
      setChallenges(challengesRes?.challenges || []);
      setOffers(offersRes?.offers || []);
      if (kids.length > 0 && !selectedChild) setSelectedChild(kids[0].id);
    } catch (e) { console.log('Load error:', e); }
  }, [selectedChild]);

  const loadProgress = useCallback(async (childId: string) => {
    try {
      setLoading(true);
      const res = await api.get(`/parent/child/${childId}/progress`);
      setProgress(res);
    } catch {
      const child = children.find(c => c.id === childId);
      if (child) setProgress({
        childId: child.id, childName: child.name, belt: child.belt || 'WHITE',
        group: child.group || '', coachName: child.coachName || 'Тренер',
        attendance: { percent: child.attendance || 0, total: 0, present: 0, warned: 0, absent: 0 },
        streak: child.streak || 0, monthlyGoal: { target: 12, current: 0 },
        achievements: child.achievements || [], competitions: [],
        riskLevel: child.status === 'RISK' ? 'critical' : child.status === 'WARNING' ? 'warning' : 'low',
      });
    } finally { setLoading(false); setRefreshing(false); }
  }, [children]);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selectedChild) loadProgress(selectedChild); }, [selectedChild]);

  const refresh = async () => { setRefreshing(true); await loadAll(); if (selectedChild) await loadProgress(selectedChild); };

  const handleFreeze = async (childId: string) => {
    try {
      await api.post(`/parent/streaks/${childId}/freeze`);
      Alert.alert('🧊 Freeze використано!', 'Серія збережена. Freeze відновиться наступного тижня.');
      await loadAll();
    } catch { Alert.alert('Помилка', 'Не вдалось використати freeze'); }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      const res = await api.post(`/parent/offers/${offerId}/accept`);
      Alert.alert('✅ Знижку активовано!', `Знижка -${res.percent}% застосована до абонементу.`);
      setOffers(prev => prev.filter(o => o.id !== offerId));
    } catch (e: any) { Alert.alert('Помилка', e?.response?.data?.error || 'Не вдалось активувати'); }
  };

  if (!progress && loading) return <View style={st.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const att = progress?.attendance || {};
  const goal = progress?.monthlyGoal || { target: 12, current: 0 };
  const goalPct = Math.min(100, Math.round((goal.current / Math.max(goal.target, 1)) * 100));
  const belt = progress?.belt || 'WHITE';
  const beltIdx = BELT_ORDER.indexOf(belt);
  const nextBelt = beltIdx >= 0 && beltIdx < BELT_ORDER.length - 1 ? BELT_ORDER[beltIdx + 1] : null;
  const beltProgress = Math.min(100, Math.max(10, att.percent || 0));

  return (
    <ScrollView style={st.scroll} contentContainerStyle={st.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E30613" />}
      showsVerticalScrollIndicator={false}>

      <View style={st.header}><Text style={st.title}>Прогрес</Text></View>

      {/* Child selector */}
      {children.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.chipRow} contentContainerStyle={st.chipContent}>
          {children.map(c => (
            <TouchableOpacity key={c.id} testID={`child-select-${c.id}`}
              style={[st.chip, selectedChild === c.id && st.chipActive]}
              onPress={() => setSelectedChild(c.id)}>
              <Text style={[st.chipT, selectedChild === c.id && st.chipTActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── OFFERS (urgency first) ── */}
      {offers.length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionLabel}>🎯 СПЕЦІАЛЬНІ ПРОПОЗИЦІЇ</Text>
          {offers.map(o => <OfferCard key={o.id} offer={o} onAccept={handleAcceptOffer} />)}
        </View>
      )}

      {/* ── STREAKS ── */}
      {streaks.length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionLabel}>🔥 СЕРІЯ ТРЕНУВАНЬ</Text>
          {streaks.filter(s => !selectedChild || s.childId === selectedChild).map(s => (
            <StreakCard key={s.childId} streak={s} onFreeze={handleFreeze} />
          ))}
        </View>
      )}

      {/* ── WEEKLY CHALLENGES ── */}
      {challenges.length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionLabel}>🎯 ТИЖНЕВІ ВИКЛИКИ</Text>
          {challenges.filter(c => !selectedChild || c.childId === selectedChild).map(c => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </View>
      )}

      {/* ── BELT PROGRESS ── */}
      <View style={st.section}>
        <Text style={st.sectionLabel}>🥋 ПОЯС</Text>
        <View style={st.beltCard}>
          <View style={st.beltTop}>
            <View style={[st.beltCircle, { backgroundColor: BELT_COLORS[belt] || '#F3F4F6' }]}>
              <Ionicons name="ribbon" size={28} color={belt === 'BLACK' ? '#fff' : '#374151'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.beltName}>{BELT_NAMES[belt] || belt} пояс</Text>
              {nextBelt && <Text style={st.beltNext}>Наступний: {BELT_NAMES[nextBelt]}</Text>}
            </View>
          </View>
          {nextBelt && (
            <View style={st.beltBar}>
              <View style={[st.beltBarFill, { width: `${beltProgress}%` }]} />
            </View>
          )}
        </View>
      </View>

      {/* ── ATTENDANCE ── */}
      <View style={st.section}>
        <Text style={st.sectionLabel}>📊 ВІДВІДУВАНІСТЬ</Text>
        <View style={st.attCard}>
          <View style={st.attRow}>
            <View style={st.attItem}><Text style={st.attVal}>{att.percent || 0}%</Text><Text style={st.attLbl}>Загалом</Text></View>
            <View style={st.attDiv} />
            <View style={st.attItem}><Text style={[st.attVal, { color: '#16A34A' }]}>{att.present || 0}</Text><Text style={st.attLbl}>Був</Text></View>
            <View style={st.attDiv} />
            <View style={st.attItem}><Text style={[st.attVal, { color: '#DC2626' }]}>{att.absent || 0}</Text><Text style={st.attLbl}>Пропуск</Text></View>
          </View>
          {/* Monthly goal */}
          <View style={st.goalRow}>
            <Text style={st.goalLabel}>Ціль місяця: {goal.current}/{goal.target}</Text>
            <Text style={st.goalPct}>{goalPct}%</Text>
          </View>
          <View style={st.goalBar}><View style={[st.goalBarFill, { width: `${goalPct}%` }]} /></View>
        </View>
      </View>

      {/* ── ACHIEVEMENTS ── */}
      {(progress?.achievements || []).length > 0 && (
        <View style={st.section}>
          <Text style={st.sectionLabel}>🏆 ДОСЯГНЕННЯ</Text>
          {progress.achievements.map((a: any, i: number) => (
            <View key={i} style={st.achCard}>
              <View style={st.achIcon}><Ionicons name="trophy" size={18} color="#D97706" /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.achTitle}>{a.title}</Text>
                {a.description && <Text style={st.achDesc}>{a.description}</Text>}
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8' },
  scroll: { flex: 1, backgroundColor: '#F8F8F8' },
  scrollContent: { paddingBottom: 32 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  // Child selector
  chipRow: { maxHeight: 48, marginTop: 8 },
  chipContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  chipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipT: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  chipTActive: { color: '#fff' },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 10 },
  // Streak
  streakCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  streakTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streakIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  streakEmoji: { fontSize: 24 },
  streakName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  streakLabel: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  streakNum: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  streakNumT: { fontSize: 22, fontWeight: '800' },
  streakMeta: { marginTop: 8, marginLeft: 60 },
  streakMetaT: { fontSize: 12, color: '#9CA3AF' },
  freezeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, backgroundColor: '#EFF6FF', borderRadius: 10, padding: 10 },
  freezeText: { fontSize: 13, color: '#1E40AF', flex: 1 },
  freezeBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  freezeBtnT: { fontSize: 12, fontWeight: '700', color: '#fff' },
  milestones: { flexDirection: 'row', gap: 8, marginTop: 10 },
  milestone: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  milestoneT: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  // Challenge
  challengeCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  challengeIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  challengeTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  challengeDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  challengeDays: { fontSize: 13, fontWeight: '700', color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  progressBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 14 },
  progressBarFill: { height: 8, borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  progressText: { fontSize: 12, fontWeight: '700', color: '#374151' },
  progressReward: { fontSize: 12, color: '#6B7280' },
  // Offer
  offerCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: '#FDE68A', marginBottom: 10 },
  offerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerBadge: { backgroundColor: '#DC2626', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  offerBadgeT: { fontSize: 18, fontWeight: '800', color: '#fff' },
  offerChild: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  offerMsg: { fontSize: 13, color: '#6B7280', marginTop: 2, lineHeight: 18 },
  offerTimer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10, marginTop: 12 },
  offerTimerT: { fontSize: 13, color: '#6B7280' },
  offerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#16A34A', paddingVertical: 14, borderRadius: 14, marginTop: 12 },
  offerBtnT: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Belt
  beltCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  beltTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  beltCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  beltName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  beltNext: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  beltBar: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 14 },
  beltBarFill: { height: 8, borderRadius: 4, backgroundColor: '#D97706' },
  // Attendance
  attCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  attRow: { flexDirection: 'row', alignItems: 'center' },
  attItem: { flex: 1, alignItems: 'center' },
  attVal: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  attLbl: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  attDiv: { width: 1, height: 32, backgroundColor: '#E5E7EB' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
  goalLabel: { fontSize: 13, color: '#374151' },
  goalPct: { fontSize: 13, fontWeight: '700', color: '#3B82F6' },
  goalBar: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, marginTop: 6 },
  goalBarFill: { height: 6, borderRadius: 3, backgroundColor: '#3B82F6' },
  // Achievements
  achCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  achIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  achTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  achDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
});
