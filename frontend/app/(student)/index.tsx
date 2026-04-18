import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
  TouchableOpacity, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';
import { PressScale, FadeInUp, Toast, XPPop } from '../../src/components/motion';

/**
 * JUNIOR X10 — ГОЛОВНА
 * Экран-мотиватор. Показать: я росту, я йду до поясу, я готуюсь до змагань, я не випадаю.
 * Блоки (сверху вниз):
 *  B. Hero бойца (name + belt + group + coach + progress bar)
 *  C. Один сильный state-event
 *  D. Наступне тренування (Підтвердити / Не прийду)
 *  E. Щоденні завдання
 *  F. Шлях до поясу (блок с "ще N тренувань")
 *  G. Змагання (или "Поки немає активних")
 *  H. Рекомендовано (market preview)
 */

const BELT_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  WHITE: { bg: '#F9FAFB', text: '#0F0F10', border: '#E5E7EB', label: 'Білий' },
  YELLOW: { bg: '#FEF3C7', text: '#92400E', border: '#FDE68A', label: 'Жовтий' },
  ORANGE: { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74', label: 'Помаранчевий' },
  GREEN: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7', label: 'Зелений' },
  BLUE: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD', label: 'Синій' },
  PURPLE: { bg: '#EDE9FE', text: '#5B21B6', border: '#C4B5FD', label: 'Фіолетовий' },
  BROWN: { bg: '#FED7AA', text: '#78350F', border: '#FB923C', label: 'Коричневий' },
  BLACK: { bg: '#1F2937', text: '#FFFFFF', border: '#374151', label: 'Чорний' },
};

function HeroFighter({ user, junior, streak, attendance }: any) {
  const belt = BELT_COLORS[junior?.belt || 'WHITE'] || BELT_COLORS.WHITE;
  const nextBelt = BELT_COLORS[junior?.nextBelt || 'YELLOW'] || BELT_COLORS.YELLOW;
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Учень';
  const completed = junior?.trainingsCompleted || 0;
  const total = junior?.trainingsToNext || 20;
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);

  return (
    <View style={s.hero} testID="hero-fighter">
      <View style={s.heroTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.heroName}>{name}</Text>
          <View style={s.heroMeta}>
            <View style={[s.beltPill, { backgroundColor: belt.bg, borderColor: belt.border }]}>
              <Ionicons name="ribbon" size={11} color={belt.text} />
              <Text style={[s.beltPillT, { color: belt.text }]}>{belt.label} пояс</Text>
            </View>
          </View>
          {(junior?.groupName || junior?.coachName) && (
            <Text style={s.heroGroup}>
              {junior?.groupName ? junior.groupName : ''}
              {junior?.groupName && junior?.coachName ? ' · ' : ''}
              {junior?.coachName ? junior.coachName : ''}
            </Text>
          )}
        </View>
      </View>

      {/* Belt progress bar */}
      <View style={s.beltProgress}>
        <View style={s.beltProgressHead}>
          <Text style={s.beltProgressLbl}>
            До {nextBelt.label} поясу
          </Text>
          <Text style={s.beltProgressVal}>{completed}/{total}</Text>
        </View>
        <View style={s.beltBarBg}>
          <View style={[s.beltBarFill, { width: `${pct}%`, backgroundColor: nextBelt.text === '#FFFFFF' ? '#0F0F10' : nextBelt.text }]} />
        </View>
        <Text style={s.beltProgressRemain}>
          {remaining > 0 ? `Залишилось ${remaining} тренувань` : '🏆 Готовий до атестації!'}
        </Text>
      </View>

      {/* 4 stat-cards */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={s.statVal}>{attendance || 0}%</Text>
          <Text style={s.statLbl}>Відвідуваність</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: '#F59E0B' }]}>🔥{streak || 0}</Text>
          <Text style={s.statLbl}>Серія</Text>
        </View>
        <View style={s.statCard}>
          <Text style={s.statVal}>{completed}</Text>
          <Text style={s.statLbl}>Тренувань</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statVal, { color: '#10B981' }]}>{junior?.discipline || 0}</Text>
          <Text style={s.statLbl}>Дисципліна</Text>
        </View>
      </View>
    </View>
  );
}

function EventCard({ event, onAction }: { event: any; onAction: (a: string, e?: any) => void }) {
  const palette: Record<string, { bg: string; border: string; icon: string }> = {
    warning: { bg: '#FFFBEB', border: '#FDE68A', icon: '#F59E0B' },
    danger: { bg: '#FEF2F2', border: '#FECACA', icon: '#EF4444' },
    urgent: { bg: '#FEF2F2', border: '#F87171', icon: '#DC2626' },
    achievement: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#10B981' },
    motivation: { bg: '#FFF7ED', border: '#FED7AA', icon: '#F97316' },
    success: { bg: '#F0FDF4', border: '#BBF7D0', icon: '#10B981' },
  };
  const c = palette[event.type] || palette.warning;
  return (
    <View style={[s.eventCard, { backgroundColor: c.bg, borderColor: c.border }]} testID={`event-${event.id}`}>
      <View style={s.eventRow}>
        <Ionicons name={event.icon || 'alert-circle'} size={22} color={c.icon} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.eventTitle}>{event.title}</Text>
          {event.text && <Text style={s.eventDesc}>{event.text}</Text>}
        </View>
      </View>
      {event.actions?.length > 0 && (
        <View style={s.eventActions}>
          {event.actions.slice(0, 1).map((a: any, i: number) => (
            <PressScale
              key={i}
              testID={`event-action-${a.action}`}
              style={s.eventBtn as any}
              onPress={() => onAction(a.action, event)}
            >
              <Text style={s.eventBtnText}>{a.label}</Text>
            </PressScale>
          ))}
        </View>
      )}
    </View>
  );
}

function NextTrainingCard({ training, onConfirm, onSkip }: any) {
  if (!training) return null;
  // X10: Status badge "Сьогодні" / "Завтра" / "Через N днів"
  const todayISO = new Date().toISOString().slice(0, 10);
  const trainingDate = (training.date || '').slice(0, 10);
  let statusLabel = 'НАСТУПНЕ';
  let statusColor = '#E30613';
  if (trainingDate && trainingDate === todayISO) {
    statusLabel = 'СЬОГОДНІ';
    statusColor = '#E30613';
  } else if (trainingDate) {
    const d = new Date(trainingDate);
    const now = new Date(todayISO);
    const diff = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) { statusLabel = 'ЗАВТРА'; statusColor = '#F59E0B'; }
    else if (diff > 1 && diff <= 7) { statusLabel = `ЧЕРЕЗ ${diff} ДН`; statusColor = '#3B82F6'; }
  }
  return (
    <View style={s.trainingCard} testID="next-training">
      <View style={s.tHead}>
        <View style={[s.tBadge, { backgroundColor: statusColor }]}>
          <Text style={s.tBadgeText}>{statusLabel}</Text>
        </View>
        <Text style={s.tTime}>{training.startTime}–{training.endTime}</Text>
      </View>
      <Text style={s.tTitle}>{training.title}</Text>
      <Text style={s.tLoc}>
        <Ionicons name="location" size={12} color="#9CA3AF" /> {training.location}
      </Text>
      <View style={s.tActions}>
        <PressScale testID="confirm-training-btn" style={s.tConfirm as any} onPress={onConfirm}>
          <Ionicons name="checkmark" size={16} color="#FFF" />
          <Text style={s.tConfirmText}>Підтвердити</Text>
        </PressScale>
        <PressScale testID="skip-training-btn" style={s.tSkip as any} onPress={onSkip}>
          <Text style={s.tSkipText}>Не прийду</Text>
        </PressScale>
      </View>
    </View>
  );
}

function DailyTasks({ onAction, onAllComplete }: { onAction: (a: string) => void; onAllComplete?: () => void }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const prevDone = React.useRef<number>(-1);
  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const r = await api.get('/student/gamification');
        setTasks(((r as any).data || r)?.dailyTasks || []);
      } catch {}
    })();
  }, []));
  // Trigger callback when transitioning to all done
  useEffect(() => {
    if (!tasks.length) return;
    const done = tasks.filter((t) => t.done).length;
    if (prevDone.current !== -1 && done === tasks.length && prevDone.current < tasks.length) {
      onAllComplete && onAllComplete();
    }
    prevDone.current = done;
  }, [tasks]);
  if (!tasks.length) return null;
  const done = tasks.filter((t) => t.done).length;
  return (
    <View style={s.section} testID="daily-tasks">
      <Text style={s.sectionLabel}>ЩОДЕННІ ЗАВДАННЯ · {done}/{tasks.length}</Text>
      <View style={s.dailyCard}>
        {tasks.map((t, i) => (
          <PressScale
            key={i}
            testID={`daily-${t.id}`}
            style={[s.dailyRow, i !== tasks.length - 1 && s.dailyRowBorder] as any}
            onPress={() => !t.done && onAction(t.id === 'confirm_training' ? 'schedule' : t.id === 'write_coach' ? 'coach_message' : '')}
            disabled={!!t.done}
          >
            <Ionicons
              name={t.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={t.done ? '#10B981' : '#D1D5DB'}
            />
            <Text style={[s.dailyText, t.done && s.dailyDone]}>{t.text}</Text>
            <Text style={s.dailyXp}>+{t.xp} XP</Text>
          </PressScale>
        ))}
        {done === tasks.length && (
          <View style={s.bonusBanner}>
            <Ionicons name="sparkles" size={14} color="#F59E0B" />
            <Text style={s.bonusText}>🎉 Всі завдання виконані! +20 XP бонус за день</Text>
          </View>
        )}
      </View>
      <Text style={s.dailyHint}>
        💡 Виконання завдань підвищує дисципліну
      </Text>
    </View>
  );
}

function BeltPathBlock({ junior }: { junior: any }) {
  if (!junior) return null;
  const completed = junior?.trainingsCompleted || 0;
  const total = junior?.trainingsToNext || 20;
  const remaining = Math.max(0, total - completed);
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;
  const nextBelt = BELT_COLORS[junior?.nextBelt || 'YELLOW'] || BELT_COLORS.YELLOW;

  return (
    <View style={s.section} testID="belt-path">
      <Text style={s.sectionLabel}>ШЛЯХ ДО ПОЯСУ</Text>
      <View style={[s.beltPathCard, { borderColor: nextBelt.border }]}>
        <View style={s.beltPathHead}>
          <Ionicons name="ribbon" size={22} color={nextBelt.text === '#FFFFFF' ? '#0F0F10' : nextBelt.text} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.beltPathT}>
              Ще {remaining} тренувань до {nextBelt.label}
            </Text>
            <Text style={s.beltPathSub}>
              {pct >= 80 ? 'Фінішна пряма 🔥' : pct >= 50 ? 'Вже більше половини' : 'Кожне тренування наближає'}
            </Text>
          </View>
          <Text style={s.beltPathPct}>{Math.round(pct)}%</Text>
        </View>
        <View style={s.beltPathBarBg}>
          <View
            style={[
              s.beltPathBarFill,
              {
                width: `${pct}%`,
                backgroundColor: nextBelt.text === '#FFFFFF' ? '#0F0F10' : nextBelt.text,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

function CompetitionsBlock({ junior }: { junior: any }) {
  const list = junior?.competitions || [];
  const upcoming = junior?.upcomingCompetitions || [];
  const trainingsLeft = junior?.trainingsToNext != null ? junior.trainingsToNext : null;

  return (
    <View style={s.section} testID="competitions-block">
      <Text style={s.sectionLabel}>ЗМАГАННЯ</Text>
      {upcoming.length > 0 ? (
        upcoming.slice(0, 2).map((c: any, i: number) => {
          const days = c.daysUntil;
          const isUrgent = days != null && days <= 14;
          const isVeryUrgent = days != null && days <= 7;
          const trainingsEstimate = days != null ? Math.max(1, Math.floor(days / 3)) : null;
          return (
            <View
              key={i}
              style={[s.compCard, isUrgent && s.compCardUrgent, isVeryUrgent && s.compCardVeryUrgent]}
              testID={`comp-upcoming-${i}`}
            >
              <View style={[s.compIcon, isUrgent && { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="trophy" size={20} color={isUrgent ? '#E30613' : '#F59E0B'} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.compName}>{c.name}</Text>
                <View style={s.compMetaRow}>
                  <Text style={[s.compMeta, isUrgent && s.compMetaUrgent]}>
                    {days != null ? `До турніру ${days} ${days === 1 ? 'день' : days < 5 ? 'дні' : 'днів'}` : c.date}
                  </Text>
                  {trainingsEstimate != null && days != null && days <= 30 && (
                    <Text style={s.compPressure}>
                      · ще ~{trainingsEstimate} тренувань
                    </Text>
                  )}
                </View>
                {isVeryUrgent && (
                  <Text style={s.compUrgencyHint}>🔥 Скоро — час готуватись!</Text>
                )}
              </View>
              <View style={[s.compCta, isUrgent && s.compCtaUrgent]}>
                <Text style={[s.compCtaT, isUrgent && s.compCtaTUrgent]}>Деталі</Text>
              </View>
            </View>
          );
        })
      ) : list.length > 0 ? (
        list.slice(0, 3).map((c: any, i: number) => (
          <View key={i} style={s.compCard} testID={`comp-past-${i}`}>
            <View style={s.compIcon}>
              <Text style={s.compMedal}>
                {c.medal === 'gold' ? '🥇' : c.medal === 'silver' ? '🥈' : c.medal === 'bronze' ? '🥉' : '🏆'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.compName}>{c.name}</Text>
              <Text style={s.compMeta}>
                {c.place ? `${c.place} місце` : 'Учасник'}
              </Text>
            </View>
          </View>
        ))
      ) : (
        <View style={s.emptyComp} testID="comp-empty">
          <Ionicons name="trophy-outline" size={28} color="#D1D5DB" />
          <Text style={s.emptyCompT}>Поки немає активних змагань</Text>
          <Text style={s.emptyCompS}>Ми повідомимо, коли відкриється реєстрація</Text>
        </View>
      )}
    </View>
  );
}

export default function StudentHome() {
  const [data, setData] = useState<any>(null);
  const [rank, setRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [coachMsg, setCoachMsg] = useState('');
  const [skipFlow, setSkipFlow] = useState<'hidden' | 'reason' | 'followup'>('hidden');
  const [skipReason, setSkipReason] = useState('');
  const [toast, setToast] = useState<{ visible: boolean; text: string; tone?: 'success' | 'soft' | 'info'; icon?: string }>({ visible: false, text: '' });
  const [xpPop, setXpPop] = useState<{ visible: boolean; xp: number }>({ visible: false, xp: 0 });
  const user = useStore((st) => st.user);
  const router = useRouter();
  const params = useLocalSearchParams<{ openCoach?: string }>();

  // Sprint 3: auto-open coach modal when navigated from Feed's "Написати тренеру"
  useEffect(() => {
    if (params.openCoach === '1') {
      setShowCoachModal(true);
      // Clear param so it doesn't re-trigger
      router.setParams({ openCoach: '' } as any);
    }
  }, [params.openCoach]);

  const fetchData = async () => {
    try {
      const [hr, rr] = await Promise.all([
        api.get('/student/home').catch(() => null),
        api.get('/student/group-rank').catch(() => null),
      ]);
      if (hr) {
        const d = (hr as any).data || hr;
        setData(d);
        if (d?.student?.studentType && user) {
          useStore.setState({ user: { ...user, studentType: d.student.studentType } as any });
        }
      }
      if (rr) setRank((rr as any).data || rr);
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

  const onAction = async (action: string, event?: any) => {
    switch (action) {
      case 'schedule':
        router.push('/(student)/schedule' as any);
        break;
      case 'progress':
        router.push('/(student)/progress' as any);
        break;
      case 'market':
        router.push('/(student)/market' as any);
        break;
      case 'coach_message':
        setShowCoachModal(true);
        break;
      case 'confirm_training':
        try {
          await api.post('/student/confirm-training', { trainingId: event?.trainingId || data?.todayTraining?.id, status: 'CONFIRMED' });
          // Sprint 3 MUST: apply XP to real backend
          const xpRes: any = await api.post('/student/xp/apply', { source: 'training_confirm' }).catch(() => null);
          const delta = xpRes?.data?.delta || xpRes?.delta || 5;
          // X10 Behavior: XP animation + success toast (instead of Alert)
          setXpPop({ visible: true, xp: delta });
          setToast({ visible: true, text: '🔥 Ти молодець! Тренер отримав сповіщення', tone: 'success', icon: 'checkmark-circle' });
          fetchData();
        } catch {
          setToast({ visible: true, text: 'Не вдалося підтвердити. Спробуйте ще раз', tone: 'info', icon: 'alert-circle' });
        }
        break;
      case 'skip_training':
        setSkipFlow('reason');
        break;
      case 'pay_subscription':
      case 'pay_debt':
        Alert.alert('Оплата', 'WayForPay (mock)');
        break;
    }
  };

  const sendCoach = async () => {
    if (!coachMsg.trim()) return;
    try {
      await api.post('/student/coach-message', { text: coachMsg });
      Alert.alert('✅', 'Надіслано тренеру');
      setShowCoachModal(false);
      setCoachMsg('');
    } catch {
      Alert.alert('Помилка');
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#E30613" />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={s.center}>
        <Ionicons name="cloud-offline-outline" size={48} color="#D1D5DB" />
        <Text style={{ color: '#6B7280', marginTop: 12 }}>Не вдалося завантажити</Text>
        <TouchableOpacity testID="retry-btn" onPress={fetchData} style={s.retryBtn}>
          <Text style={{ color: '#FFF', fontWeight: '700' }}>Спробувати</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const junior = data.junior || null;
  const isJunior = (data?.student?.studentType || 'JUNIOR') === 'JUNIOR';
  const training = data.todayTraining;
  const events = (data.events || []).slice(0, 1);
  const recs = (data.marketplaceRecs || []).slice(0, 4);
  const streak = data.streak || 0;
  const attendance = data.attendance?.percent || data.attendancePercent || 0;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Toast visible={toast.visible} text={toast.text} tone={toast.tone} icon={toast.icon} onHide={() => setToast({ visible: false, text: '' })} />
      <XPPop visible={xpPop.visible} xp={xpPop.xp} onDone={() => setXpPop({ visible: false, xp: 0 })} />
      <ScrollView
        style={s.scroll}
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
        {/* B. HERO бойца (только для Junior; Adult использует свой экран) */}
        {isJunior && (
          <FadeInUp>
            <HeroFighter user={user} junior={junior} streak={streak} attendance={attendance} />
          </FadeInUp>
        )}

        {/* Group Rank pill (Junior mini-leaderboard) */}
        {isJunior && rank?.position != null && (
          <FadeInUp delay={80}>
            <PressScale
              testID="group-rank-pill"
              style={s.rankPill as any}
              onPress={() => router.push('/(student)/progress' as any)}
            >
              <View style={s.rankIcon}>
                <Ionicons name="trophy" size={16} color="#F59E0B" />
              </View>
              <Text style={s.rankT}>
                Ви #{rank.position} у групі «{rank.groupName}»
              </Text>
              {rank.clubPosition && rank.clubTotal > 0 && (
                <Text style={s.rankSub}>· #{rank.clubPosition} у клубі</Text>
              )}
            </PressScale>
          </FadeInUp>
        )}

        {/* C. Один сильный state-event */}
        {events.map((e: any, i: number) => (
          <FadeInUp key={i} delay={120}>
            <EventCard event={e} onAction={onAction} />
          </FadeInUp>
        ))}

        {/* D. Наступне тренування */}
        <FadeInUp delay={160}>
          <NextTrainingCard
            training={training}
            onConfirm={() => onAction('confirm_training')}
            onSkip={() => onAction('skip_training')}
          />
        </FadeInUp>

        {/* E. Щоденні завдання */}
        <FadeInUp delay={200}>
          <DailyTasks
            onAction={onAction}
            onAllComplete={() => {
              setToast({ visible: true, text: '🎉 Всі завдання виконані! +20 XP бонус', tone: 'success', icon: 'sparkles' });
              setXpPop({ visible: true, xp: 20 });
            }}
          />
        </FadeInUp>

        {/* F. Шлях до поясу (только Junior) */}
        {isJunior && junior && (
          <FadeInUp delay={240}>
            <BeltPathBlock junior={junior} />
          </FadeInUp>
        )}

        {/* G. Змагання (только Junior) */}
        {isJunior && (
          <FadeInUp delay={280}>
            <CompetitionsBlock junior={junior} />
          </FadeInUp>
        )}

        {/* H. Рекомендовано */}
        {recs.length > 0 && (
          <View style={s.section} testID="recommended-block">
            <View style={s.sectionHead}>
              <Text style={s.sectionLabel}>РЕКОМЕНДОВАНО</Text>
              <TouchableOpacity testID="open-market-btn" onPress={() => router.push('/(student)/market' as any)}>
                <Text style={s.sectionLink}>Маркет →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {recs.map((p: any, i: number) => (
                <TouchableOpacity
                  key={i}
                  style={s.miniProd}
                  testID={`mini-prod-${i}`}
                  onPress={() => router.push('/(student)/market' as any)}
                >
                  <View style={s.miniIcon}>
                    <Ionicons name="bag-handle" size={18} color="#E30613" />
                  </View>
                  <Text style={s.miniName} numberOfLines={2}>
                    {p.name}
                  </Text>
                  <View style={s.miniPriceRow}>
                    <Text style={s.miniPrice}>{p.price} ₴</Text>
                    {p.oldPrice && p.oldPrice > p.price && (
                      <Text style={s.miniOldPrice}>{p.oldPrice}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Skip Training Flow Modal */}
      <Modal visible={skipFlow !== 'hidden'} transparent animationType="slide">
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {skipFlow === 'reason' && (
              <>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Чому не прийдеш?</Text>
                  <TouchableOpacity testID="skip-close" onPress={() => setSkipFlow('hidden')}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <Text style={s.skipSub}>Тренер отримає сповіщення</Text>
                {[
                  { k: 'busy', l: 'Зайнятий', ic: 'briefcase' },
                  { k: 'sick', l: 'Захворів', ic: 'medkit' },
                  { k: 'family', l: 'Сімейні справи', ic: 'home' },
                  { k: 'other', l: 'Інше', ic: 'ellipsis-horizontal' },
                ].map((r) => (
                  <TouchableOpacity
                    key={r.k}
                    testID={`skip-reason-${r.k}`}
                    style={s.reasonRow}
                    onPress={async () => {
                      try {
                        await api.post('/student/absence', {
                          trainingId: data?.todayTraining?.id,
                          reason: r.l,
                        });
                        setSkipReason(r.l);
                        setSkipFlow('followup');
                      } catch {
                        Alert.alert('Помилка');
                      }
                    }}
                  >
                    <Ionicons name={r.ic as any} size={20} color="#6B7280" />
                    <Text style={s.reasonT}>{r.l}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </TouchableOpacity>
                ))}
              </>
            )}
            {skipFlow === 'followup' && (
              <>
                <View style={s.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modalTitle}>Відмічено · {skipReason}</Text>
                    <Text style={s.skipSub}>Що далі?</Text>
                  </View>
                  <TouchableOpacity
                    testID="skip-followup-close"
                    onPress={() => {
                      setSkipFlow('hidden');
                      setSkipReason('');
                      fetchData();
                    }}
                  >
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  testID="skip-reschedule"
                  style={s.followCta}
                  onPress={() => {
                    setSkipFlow('hidden');
                    setSkipReason('');
                    router.push('/(student)/schedule' as any);
                  }}
                >
                  <Ionicons name="calendar" size={20} color="#3B82F6" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.followCtaT}>Перенести</Text>
                    <Text style={s.followCtaS}>Обери інше тренування</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="skip-write-coach"
                  style={s.followCta}
                  onPress={() => {
                    setSkipFlow('hidden');
                    setSkipReason('');
                    setShowCoachModal(true);
                  }}
                >
                  <Ionicons name="chatbubble-ellipses" size={20} color="#7C3AED" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.followCtaT}>Написати тренеру</Text>
                    <Text style={s.followCtaS}>Пояснити ситуацію</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </TouchableOpacity>
                <TouchableOpacity
                  testID="skip-ok"
                  style={s.followOk}
                  onPress={() => {
                    setSkipFlow('hidden');
                    setSkipReason('');
                    fetchData();
                  }}
                >
                  <Text style={s.followOkT}>Добре</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Coach Modal */}
      <Modal visible={showCoachModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Написати тренеру</Text>
              <TouchableOpacity onPress={() => setShowCoachModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="coach-msg-input"
              style={s.msgInput}
              value={coachMsg}
              onChangeText={setCoachMsg}
              placeholder="Ваше повідомлення..."
              multiline
              textAlignVertical="top"
            />
            <TouchableOpacity testID="send-coach-btn" style={s.sendBtn} onPress={sendCoach}>
              <Ionicons name="send" size={18} color="#FFF" />
              <Text style={s.sendText}>Надіслати</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  retryBtn: {
    backgroundColor: '#E30613',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 12,
  },

  // Section wrapper — vertical rhythm 24
  section: { marginTop: 24 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 1,
    marginBottom: 12,
  },
  sectionLink: { fontSize: 12, fontWeight: '700', color: '#E30613' },

  // B. Hero — Level 1 (shadow-md, no border)
  hero: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginTop: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroName: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  heroMeta: { flexDirection: 'row', marginTop: 6 },
  beltPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  beltPillT: { fontSize: 12, fontWeight: '700' },
  heroGroup: { fontSize: 13, color: '#6B7280', marginTop: 6 },

  beltProgress: { marginTop: 16 },
  beltProgressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  beltProgressLbl: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  beltProgressVal: { fontSize: 14, fontWeight: '800', color: '#0F0F10' },
  beltBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  beltBarFill: { height: 8, borderRadius: 4 },
  beltProgressRemain: { fontSize: 12, color: '#10B981', fontWeight: '700', marginTop: 6 },

  statsRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  statCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statVal: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  statLbl: { fontSize: 10, color: '#6B7280', marginTop: 2, textAlign: 'center' },

  // C. Event
  eventCard: { borderRadius: 14, padding: 14, marginTop: 14, borderWidth: 1 },
  eventRow: { flexDirection: 'row', alignItems: 'flex-start' },
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  eventDesc: { fontSize: 13, color: '#4B5563', marginTop: 2 },
  eventActions: { marginTop: 10 },
  eventBtn: { backgroundColor: '#0F0F10', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  eventBtnText: { fontSize: 13, fontWeight: '700', color: '#FFF' },

  // D. Training — Level 1 (bigger, bolder as per X10 review)
  trainingCard: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  tHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tBadge: {
    backgroundColor: '#E30613',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  tTime: { fontSize: 15, fontWeight: '800', color: '#0F0F10' },
  tTitle: { fontSize: 17, fontWeight: '800', color: '#0F0F10', marginTop: 6 },
  tLoc: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },
  tActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  tConfirm: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
  },
  tConfirmText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  tSkip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 14,
  },
  tSkipText: { color: '#6B7280', fontSize: 14, fontWeight: '700' },

  // E. Daily
  dailyCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  dailyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  dailyRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  dailyText: { flex: 1, fontSize: 14, color: '#374151' },
  dailyDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  dailyXp: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  bonusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
    margin: 4,
  },
  bonusText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  dailyHint: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Group Rank pill
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  rankIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankT: { fontSize: 13, fontWeight: '700', color: '#92400E', flex: 1 },
  rankSub: { fontSize: 12, color: '#B45309', fontWeight: '600' },

  // Skip flow
  skipSub: { fontSize: 13, color: '#6B7280', marginTop: 2, marginBottom: 10 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  reasonT: { flex: 1, fontSize: 15, color: '#0F0F10', fontWeight: '600' },
  followCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  followCtaT: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  followCtaS: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  followOk: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#0F0F10',
    marginTop: 8,
  },
  followOkT: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // F. Belt path
  beltPathCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  beltPathHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  beltPathT: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  beltPathSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  beltPathPct: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  beltPathBarBg: { height: 10, backgroundColor: '#F3F4F6', borderRadius: 5, overflow: 'hidden' },
  beltPathBarFill: { height: 10, borderRadius: 5 },

  // G. Competitions
  compCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  compIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compMedal: { fontSize: 20 },
  compName: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  compMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  compCta: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  compCtaT: { fontSize: 12, fontWeight: '700', color: '#E30613' },
  // Sprint 3 MUST: urgency states
  compCardUrgent: { borderColor: '#FECACA', backgroundColor: '#FFFBFA' },
  compCardVeryUrgent: { borderColor: '#E30613', backgroundColor: '#FEF2F2' },
  compMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  compMetaUrgent: { color: '#E30613', fontWeight: '700' },
  compPressure: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginLeft: 4 },
  compUrgencyHint: { fontSize: 11, color: '#E30613', fontWeight: '700', marginTop: 4 },
  compCtaUrgent: { backgroundColor: '#E30613' },
  compCtaTUrgent: { color: '#FFF' },
  emptyComp: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyCompT: { fontSize: 14, color: '#6B7280', fontWeight: '600', marginTop: 8 },
  emptyCompS: { fontSize: 12, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },

  // H. Recommended
  miniProd: {
    width: 110,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  miniIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  miniName: { fontSize: 12, fontWeight: '600', color: '#0F0F10', minHeight: 30 },
  miniPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  miniPrice: { fontSize: 13, fontWeight: '800', color: '#E30613' },
  miniOldPrice: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
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
    gap: 8,
    backgroundColor: '#E30613',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  sendText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
