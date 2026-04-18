import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { useStore } from '../../src/store/useStore';

/**
 * COACH X10 — PANEL (Головний екран тренера)
 * Action-first control center.
 *
 * Блоки:
 *  A. Header (Club + Coach)
 *  B. СЬОГОДНІ (load + fire)
 *  C. ПОТРЕБУЮТЬ РЕАКЦІЇ (actionable student cards)
 *  D. ЩО РОБИТИ ЗАРАЗ (AI recommendations)
 *  E. МОЇ ТРЕНУВАННЯ (upcoming sessions)
 *  F. МОЯ ЕФЕКТИВНІСТЬ (KPI)
 */

type ActionType = 'write' | 'reschedule' | 'return' | 'parent' | 'praise' | 'upsell';

const ACTION_CFG: Record<ActionType, { label: string; icon: string; color: string; bg: string }> = {
  write: { label: 'Написати', icon: 'chatbubble-ellipses', color: '#7C3AED', bg: '#F5F3FF' },
  reschedule: { label: 'Перенести', icon: 'calendar', color: '#3B82F6', bg: '#EFF6FF' },
  return: { label: 'Повернути', icon: 'refresh-circle', color: '#EF4444', bg: '#FEF2F2' },
  parent: { label: 'Батьки', icon: 'call', color: '#3B82F6', bg: '#EFF6FF' },
  praise: { label: 'Похвалити', icon: 'heart', color: '#E30613', bg: '#FEF2F2' },
  upsell: { label: 'Індивідуалка', icon: 'cash', color: '#F59E0B', bg: '#FFFBEB' },
};

const REACTION_CFG: Record<string, { color: string; bg: string; icon: string }> = {
  not_coming: { color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle' },
  missed: { color: '#F59E0B', bg: '#FFFBEB', icon: 'warning' },
  progress: { color: '#10B981', bg: '#F0FDF4', icon: 'flame' },
};

function TodayBlock({ today }: { today: any }) {
  const items = [
    { val: today?.trainingsCount ?? 0, lbl: 'тренування', color: '#0F0F10' },
    { val: today?.studentsCount ?? 0, lbl: 'учнів', color: '#3B82F6' },
    { val: today?.riskCount ?? 0, lbl: 'ризикові', color: '#EF4444' },
    { val: today?.upsellReadyCount ?? 0, lbl: 'upsell-ready', color: '#F59E0B' },
  ];
  return (
    <View style={s.section} testID="today-block">
      <Text style={s.sectionLabel}>СЬОГОДНІ</Text>
      <View style={s.todayGrid}>
        {items.map((it, i) => (
          <View key={i} style={s.todayItem}>
            <Text style={[s.todayVal, { color: it.color }]}>{it.val}</Text>
            <Text style={s.todayLbl}>{it.lbl}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReactionCard({
  r,
  onAction,
  actionFeedback,
}: {
  r: any;
  onAction: (studentId: string, name: string, action: ActionType) => void;
  actionFeedback?: { label: string; minsAgo: number };
}) {
  const cfg = REACTION_CFG[r.type] || REACTION_CFG.missed;
  return (
    <View style={[s.reactionCard, { borderLeftColor: cfg.color }]} testID={`reaction-${r.id}`}>
      <View style={s.reactionTop}>
        <View style={[s.reactionIconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={16} color={cfg.color} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.reactionName}>{r.name}</Text>
          <Text style={[s.reactionLabel, { color: cfg.color }]}>
            {r.label} {r.reason ? `· ${r.reason}` : ''}
          </Text>
        </View>
      </View>
      {actionFeedback ? (
        <View style={s.feedbackBox} testID={`feedback-${r.id}`}>
          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          <Text style={s.feedbackT}>
            {actionFeedback.label} · {actionFeedback.minsAgo === 0 ? 'щойно' : `${actionFeedback.minsAgo} хв тому`}
          </Text>
          <Text style={s.feedbackSub}>Очікує відповідь</Text>
        </View>
      ) : (
        <View style={s.reactionActions}>
          {(r.actions || []).slice(0, 2).map((a: ActionType, i: number) => {
            const acfg = ACTION_CFG[a];
            if (!acfg) return null;
            return (
              <TouchableOpacity
                key={i}
                testID={`reaction-${r.id}-${a}`}
                style={[s.reactionBtn, { backgroundColor: acfg.bg }]}
                onPress={() => onAction(r.id, r.name, a)}
              >
                <Ionicons name={acfg.icon as any} size={13} color={acfg.color} />
                <Text style={[s.reactionBtnT, { color: acfg.color }]}>{acfg.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function WhatToDoCard({
  item,
  onDo,
  onSnooze,
}: {
  item: any;
  onDo: (item: any) => void;
  onSnooze: (id: string) => void;
}) {
  return (
    <View style={s.whatCard} testID={`what-${item.id}`}>
      <View style={s.whatIconBox}>
        <Ionicons name={item.icon || 'bulb'} size={18} color="#E30613" />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.whatTitle}>{item.title}</Text>
        {item.reason && <Text style={s.whatReason}>— {item.reason}</Text>}
      </View>
      <View style={s.whatActions}>
        <TouchableOpacity
          testID={`what-do-${item.id}`}
          style={s.whatDoBtn}
          onPress={() => onDo(item)}
        >
          <Text style={s.whatDoT}>Виконати</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`what-snooze-${item.id}`}
          style={s.whatSnoozeBtn}
          onPress={() => onSnooze(item.id)}
        >
          <Ionicons name="time-outline" size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function UpcomingCard({ t, onOpen }: { t: any; onOpen: (t: any) => void }) {
  return (
    <TouchableOpacity
      testID={`upcoming-${t.id || t.startTime}`}
      style={s.upCard}
      onPress={() => onOpen(t)}
    >
      <View style={s.upLeft}>
        <Text style={s.upTime}>{t.startTime || t.time?.split('-')[0] || '—'}</Text>
        {t.dateLabel && <Text style={s.upDate}>{t.dateLabel}</Text>}
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.upGroup}>{t.group}</Text>
        <Text style={s.upMeta}>
          {t.studentsCount ?? 0} учнів{t.notComingCount ? ` · ${t.notComingCount} не прийдуть` : ''}
        </Text>
      </View>
      <View style={s.upCta}>
        <Text style={s.upCtaT}>Відкрити</Text>
        <Ionicons name="chevron-forward" size={16} color="#E30613" />
      </View>
    </TouchableOpacity>
  );
}

function EffectivenessBlock({ eff, onOpen }: { eff: any; onOpen: () => void }) {
  const items = [
    { val: eff?.returnedStudents ?? 0, lbl: 'Повернув учнів', icon: 'refresh-circle', color: '#10B981' },
    { val: `${eff?.conversionRate ?? 0}%`, lbl: 'Конверсія', icon: 'trending-up', color: '#3B82F6' },
    { val: eff?.upsellCount ?? 0, lbl: 'Індивідуалки', icon: 'cash', color: '#F59E0B' },
    { val: eff?.retentionScore ?? 0, lbl: 'Retention score', icon: 'shield-checkmark', color: '#7C3AED' },
  ];
  return (
    <View style={s.section} testID="effectiveness-block">
      <View style={s.sectionHead}>
        <Text style={s.sectionLabel}>МОЯ ЕФЕКТИВНІСТЬ</Text>
        <TouchableOpacity testID="open-analytics" onPress={onOpen}>
          <Text style={s.sectionLink}>Детальніше</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity activeOpacity={0.8} onPress={onOpen}>
        <View style={s.effGrid}>
          {items.map((it, i) => (
            <View key={i} style={s.effItem}>
              <Ionicons name={it.icon as any} size={16} color={it.color} />
              <Text style={s.effVal}>{it.val}</Text>
              <Text style={s.effLbl}>{it.lbl}</Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function CoachPanel() {
  const router = useRouter();
  const user = useStore((st) => st.user);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [writeTarget, setWriteTarget] = useState<{ id: string; name: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [snoozed, setSnoozed] = useState<string[]>([]);
  const [coachActions, setCoachActions] = useState<Record<string, { label: string; at: number }>>({});

  const trackAction = (studentId: string, label: string) => {
    setCoachActions((prev) => ({ ...prev, [studentId]: { label, at: Date.now() } }));
  };

  const feedbackFor = (studentId: string) => {
    const a = coachActions[studentId];
    if (!a) return undefined;
    const minsAgo = Math.max(0, Math.floor((Date.now() - a.at) / 60000));
    return { label: a.label, minsAgo };
  };

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

  const handleReactionAction = (studentId: string, name: string, action: ActionType) => {
    if (action === 'write' || action === 'return') {
      setWriteTarget({ id: studentId, name });
      setMsg(action === 'return' ? `${name.split(' ')[0]}, чекаємо тебе на наступному тренуванні!` : '');
    } else if (action === 'praise') {
      setWriteTarget({ id: studentId, name });
      setMsg(`${name.split(' ')[0]}, молодець! Тримай так далі 💪`);
    } else if (action === 'upsell') {
      setWriteTarget({ id: studentId, name });
      setMsg(`${name.split(' ')[0]}, бачу сильний прогрес. Є пропозиція — індивідуальне тренування. Цікаво?`);
    } else if (action === 'reschedule') {
      Alert.alert('Перенести тренування', `Оберіть новий час для ${name} у Розкладі`, [
        { text: 'Відкрити розклад', onPress: () => router.push('/(coach)/schedule') },
        { text: 'Скасувати', style: 'cancel' },
      ]);
    } else if (action === 'parent') {
      Alert.alert('Контакт батьків', `Зателефонуйте батькам ${name}`);
    }
  };

  const handleWhatDo = (item: any) => {
    const name = item.title?.split(' ')[1] || 'учень';
    if (item.action === 'write') {
      setWriteTarget({ id: item.studentId, name });
    } else if (item.action === 'praise') {
      setWriteTarget({ id: item.studentId, name });
      setMsg(`${name}, молодець! 💪`);
    } else if (item.action === 'upsell') {
      setWriteTarget({ id: item.studentId, name });
      setMsg(`${name}, бачу сильний прогрес. Запропоную тобі індивідуальне тренування.`);
    }
  };

  const sendMessage = async () => {
    if (!msg.trim() || !writeTarget) return;
    try {
      await api.post('/student/coach-message', { text: msg, toStudentId: writeTarget.id });
      trackAction(writeTarget.id, 'Написано');
      setWriteTarget(null);
      setMsg('');
      fetchData();
    } catch {
      Alert.alert('Помилка надсилання');
    }
  };

  if (loading)
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#E30613" />
      </View>
    );
  if (!data)
    return (
      <View style={s.center}>
        <Text style={{ color: '#6B7280' }}>Помилка завантаження</Text>
      </View>
    );

  const todayBlock = data.today || {};
  const needsReaction = data.needsReaction || [];
  const whatToDo = (data.whatToDoNow || []).filter((w: any) => !snoozed.includes(w.id));
  const upcoming = data.upcomingTrainings || [];
  const eff = data.myEffectiveness || {};

  const coachName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Тренер';

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView
        style={s.scr}
        contentContainerStyle={{ paddingBottom: 40 }}
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
        {/* A. HEADER */}
        <View style={s.headerBlock} testID="coach-header-block">
          <Text style={s.clubName}>АТАКА Київ</Text>
          <Text style={s.coachLine}>Coach · {coachName}</Text>
        </View>

        {/* B. СЬОГОДНІ */}
        <TodayBlock today={todayBlock} />

        {/* C. ПОТРЕБУЮТЬ РЕАКЦІЇ */}
        {(() => {
          const hasRisk = (todayBlock.riskCount ?? 0) > 0 || (data.summary?.risk ?? 0) > 0;
          // Fallback: if backend didn't populate needsReaction but we have at-risk students,
          // synthesize action cards from atRisk[] so the block never contradicts the data.
          let items = needsReaction;
          if (items.length === 0 && hasRisk) {
            items = (data.atRisk || []).slice(0, 5).map((st: any) => ({
              id: st.id,
              name: st.name,
              type: 'missed',
              label: st.consecutiveMisses >= 2 ? `${st.consecutiveMisses} пропуски` : 'Ризик',
              reason: st.riskReasons?.[0] || st.lastAbsenceReason || `Відвідуваність ${st.attendanceRate}%`,
              actions: st.type === 'JUNIOR' ? ['return', 'parent'] : ['return', 'write'],
            }));
          }
          return (
            <View style={s.section} testID="needs-reaction-block">
              <View style={s.sectionHead}>
                <Text style={s.sectionLabel}>ПОТРЕБУЮТЬ РЕАКЦІЇ</Text>
                {items.length > 0 && (
                  <View style={s.sectionBadge}>
                    <Text style={s.sectionBadgeT}>{items.length}</Text>
                  </View>
                )}
              </View>
              {items.length === 0 ? (
                <View style={s.emptyBlock}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text style={s.emptyT}>Все під контролем</Text>
                </View>
              ) : (
                items.map((r: any) => (
                  <ReactionCard
                    key={r.id}
                    r={r}
                    onAction={handleReactionAction}
                    actionFeedback={feedbackFor(r.id)}
                  />
                ))
              )}
            </View>
          );
        })()}

        {/* D. ЩО РОБИТИ ЗАРАЗ */}
        {whatToDo.length > 0 && (
          <View style={s.section} testID="what-to-do-block">
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>ЩО РОБИТИ ЗАРАЗ</Text>
              <Ionicons name="sparkles" size={14} color="#F59E0B" />
            </View>
            {whatToDo.map((w: any) => (
              <WhatToDoCard
                key={w.id}
                item={w}
                onDo={handleWhatDo}
                onSnooze={(id) => setSnoozed((prev) => [...prev, id])}
              />
            ))}
          </View>
        )}

        {/* E. МОЇ ТРЕНУВАННЯ */}
        {upcoming.length > 0 && (
          <View style={s.section} testID="upcoming-block">
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>МОЇ ТРЕНУВАННЯ</Text>
              <TouchableOpacity
                testID="open-schedule"
                onPress={() => router.push('/(coach)/schedule')}
              >
                <Text style={s.sectionLink}>Весь розклад</Text>
              </TouchableOpacity>
            </View>
            {upcoming.map((t: any, i: number) => (
              <UpcomingCard
                key={t.id || i}
                t={t}
                onOpen={(tr) => {
                  if (tr.groupId) router.push(`/coach/group/${tr.groupId}`);
                  else router.push('/(coach)/schedule');
                }}
              />
            ))}
          </View>
        )}

        {/* F. МОЯ ЕФЕКТИВНІСТЬ */}
        <EffectivenessBlock eff={eff} onOpen={() => router.push('/coach/kpi')} />
      </ScrollView>

      {/* Write Modal */}
      <Modal visible={!!writeTarget} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOv}
        >
          <View style={s.modalC}>
            <View style={s.modalH}>
              <Text style={s.modalT}>Написати {writeTarget?.name}</Text>
              <TouchableOpacity
                testID="modal-close"
                onPress={() => {
                  setWriteTarget(null);
                  setMsg('');
                }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="coach-panel-msg"
              style={s.msgInput}
              value={msg}
              onChangeText={setMsg}
              placeholder="Повідомлення..."
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity testID="coach-panel-send" style={s.sendBtn} onPress={sendMessage}>
              <Ionicons name="send" size={16} color="#FFF" />
              <Text style={s.sendT}>Надіслати</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  scr: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  // A. Header
  headerBlock: { marginTop: 14, marginBottom: 4 },
  clubName: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  coachLine: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  // Section wrapper
  section: { marginTop: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280', letterSpacing: 0.8, flex: 1 },
  sectionLink: { fontSize: 12, color: '#E30613', fontWeight: '600' },
  sectionBadge: { backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeT: { fontSize: 11, fontWeight: '800', color: '#EF4444' },

  // B. Today
  todayGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  todayItem: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  todayVal: { fontSize: 24, fontWeight: '800' },
  todayLbl: { fontSize: 11, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  // C. Reaction cards
  reactionCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderLeftWidth: 4,
  },
  reactionTop: { flexDirection: 'row', alignItems: 'center' },
  reactionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionName: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  reactionLabel: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  reactionActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  feedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  feedbackT: { fontSize: 12, fontWeight: '700', color: '#10B981' },
  feedbackSub: { fontSize: 11, color: '#6B7280', marginLeft: 'auto' },
  reactionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reactionBtnT: { fontSize: 12, fontWeight: '700' },

  // D. WhatToDo
  whatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  whatIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatTitle: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  whatReason: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  whatActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  whatDoBtn: {
    backgroundColor: '#0F0F10',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  whatDoT: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  whatSnoozeBtn: { padding: 8 },

  // E. Upcoming
  upCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  upLeft: { alignItems: 'center', minWidth: 52 },
  upTime: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  upDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  upGroup: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  upMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  upCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  upCtaT: { fontSize: 12, fontWeight: '700', color: '#E30613' },

  // F. Effectiveness
  effGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  effItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  effVal: { fontSize: 22, fontWeight: '800', color: '#0F0F10', marginTop: 6 },
  effLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  // Empty
  emptyBlock: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyT: { fontSize: 14, color: '#6B7280', fontWeight: '500' },

  // Modal
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
