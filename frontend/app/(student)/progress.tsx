import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

/**
 * JUNIOR X10 — ПРОГРЕС
 * Сильный экран роста ученика.
 *
 * Блоки:
 *  A-B. Головна ціль: current belt → next belt (with progress)
 *  C. Дисципліна (не цифра — смысл: сильна сторона / потрібно покращити)
 *  D. Серія (+ ближайший бейдж)
 *  E. XP / Рівень
 *  F. Досягнення (карточки)
 *  G. Коментар тренера
 *  H. Змагальний прогрес
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

const ACHIEVEMENTS = [
  { id: 'first_month', icon: 'calendar', color: '#7C3AED', title: 'Перший місяць', req: (d: any) => (d.totalTrainings || 0) >= 4 },
  { id: 'streak_5', icon: 'flame', color: '#F59E0B', title: '5 поспіль', req: (d: any) => (d.streak || 0) >= 5 },
  { id: 'streak_10', icon: 'trophy', color: '#EF4444', title: '10 поспіль', req: (d: any) => (d.streak || 0) >= 10 },
  { id: 'first_comp', icon: 'medal', color: '#10B981', title: 'Перший турнір', req: (d: any) => (d.competitions?.length || 0) >= 1 },
  { id: 'discipline_90', icon: 'shield-checkmark', color: '#3B82F6', title: 'Відмінна дисципліна', req: (d: any) => (d.discipline || 0) >= 90 },
  { id: 'level_5', icon: 'star', color: '#F59E0B', title: 'Рівень 5', req: (d: any) => (d.level || 0) >= 5 },
];

export default function StudentProgress() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const fetchData = async () => {
    try {
      const [home, gam] = await Promise.all([
        api.get('/student/home').catch(() => null),
        api.get('/student/gamification').catch(() => null),
      ]);
      const d = home ? ((home as any).data || home) : {};
      const g = gam ? ((gam as any).data || gam) : {};
      setData({ ...d, ...g });
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

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#E30613" />
      </View>
    );
  }

  const junior = data?.junior || {};
  const belt = BELT_COLORS[junior?.belt || 'WHITE'] || BELT_COLORS.WHITE;
  const nextBelt = BELT_COLORS[junior?.nextBelt || 'YELLOW'] || BELT_COLORS.YELLOW;
  const completed = junior?.trainingsCompleted || 0;
  const total = junior?.trainingsToNext || 20;
  const remaining = Math.max(0, total - completed);
  const pct = total > 0 ? Math.min(100, (completed / total) * 100) : 0;

  const discipline = junior?.discipline ?? data?.discipline ?? 0;
  const streak = data?.streak || 0;
  const xp = data?.xp || 0;
  const level = data?.level || 1;
  const levelName = data?.levelName || '';
  const nextLevelXp = data?.nextLevelXp || 100;
  const xpProgress = data?.xpProgress || 0;

  const coachComment = junior?.coachComment || 'Працюй далі, все йде добре!';
  const competitions = junior?.competitions || [];
  const upcomingComps = junior?.upcomingCompetitions || [];

  // Achievements unlocked
  const achContext = {
    totalTrainings: completed,
    streak,
    competitions,
    discipline,
    level,
  };
  const achievements = ACHIEVEMENTS.map((a) => ({ ...a, unlocked: a.req(achContext) }));
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  // Discipline meaning
  const discMeaning =
    discipline >= 85
      ? { strong: 'стабільність', improve: 'темп' }
      : discipline >= 65
      ? { strong: 'регулярність', improve: 'стабільність серії' }
      : { strong: 'бажання зростати', improve: 'регулярність' };

  // Streak next badge
  const nextStreakBadge =
    streak < 5
      ? { to: 5, name: 'Стабільний' }
      : streak < 10
      ? { to: 10, name: 'Відданий' }
      : streak < 20
      ? { to: 20, name: 'Залізний' }
      : { to: streak + 10, name: 'Чемпіон' };
  const streakToNext = nextStreakBadge.to - streak;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F9FAFB' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
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
      {/* A-B. Belt path hero */}
      <Text style={s.sectionLabel}>ГОЛОВНА ЦІЛЬ</Text>
      <View style={s.beltHero} testID="belt-hero">
        <View style={s.beltTrack}>
          <View style={[s.beltNode, { backgroundColor: belt.bg, borderColor: belt.border }]}>
            <Text style={[s.beltNodeT, { color: belt.text }]}>{belt.label[0]}</Text>
          </View>
          <View style={s.beltTrackLine}>
            <View style={[s.beltTrackFill, { width: `${pct}%`, backgroundColor: nextBelt.text === '#FFFFFF' ? '#0F0F10' : nextBelt.text }]} />
          </View>
          <View style={[s.beltNode, { backgroundColor: nextBelt.bg, borderColor: nextBelt.border }]}>
            <Text style={[s.beltNodeT, { color: nextBelt.text }]}>{nextBelt.label[0]}</Text>
          </View>
        </View>
        <View style={s.beltHeroInfo}>
          <Text style={s.beltHeroT}>
            {belt.label} → {nextBelt.label}
          </Text>
          <Text style={s.beltHeroNum}>
            {completed} / {total} тренувань
          </Text>
          <Text style={s.beltHeroRemain}>
            {remaining > 0 ? `Залишилось ${remaining}` : '🏆 Готовий до атестації!'}
          </Text>
        </View>
      </View>

      {/* C. Дисципліна */}
      <Text style={s.sectionLabel}>ДИСЦИПЛІНА</Text>
      <View style={s.discCard} testID="discipline-card">
        <View style={s.discRow}>
          <View style={s.discCircle}>
            <Text style={s.discVal}>{discipline}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <View style={s.discLine}>
              <Ionicons name="checkmark-circle" size={14} color="#10B981" />
              <Text style={s.discLineT}>
                Сильна сторона: <Text style={s.discBold}>{discMeaning.strong}</Text>
              </Text>
            </View>
            <View style={s.discLine}>
              <Ionicons name="arrow-up-circle" size={14} color="#F59E0B" />
              <Text style={s.discLineT}>
                Потрібно покращити: <Text style={s.discBold}>{discMeaning.improve}</Text>
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* D. Серія */}
      <Text style={s.sectionLabel}>СЕРІЯ</Text>
      <View style={s.streakCard} testID="streak-card">
        <View style={s.streakIconBox}>
          <Text style={s.streakEmoji}>🔥</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={s.streakT}>{streak} тренувань</Text>
          <Text style={s.streakSub}>
            {streakToNext > 0
              ? `Ще ${streakToNext} до бейджу «${nextStreakBadge.name}»`
              : 'Максимальний бейдж досягнуто!'}
          </Text>
        </View>
      </View>

      {/* E. XP / Рівень */}
      <Text style={s.sectionLabel}>РІВЕНЬ</Text>
      <View style={s.xpCard} testID="xp-card">
        <View style={s.xpHead}>
          <View style={s.xpLvlBadge}>
            <Text style={s.xpLvlT}>Lv.{level}</Text>
          </View>
          {levelName && <Text style={s.xpLvlName}>{levelName}</Text>}
          <Text style={s.xpAmt}>{xp} XP</Text>
        </View>
        <View style={s.xpBarBg}>
          <View style={[s.xpBarFill, { width: `${xpProgress}%` }]} />
        </View>
        <Text style={s.xpTo}>
          {Math.max(0, nextLevelXp - xp)} XP до наступного рівня
        </Text>
      </View>

      {/* F. Досягнення */}
      <View style={s.sectionHead}>
        <Text style={s.sectionLabel}>ДОСЯГНЕННЯ</Text>
        <Text style={s.sectionCounter}>
          {unlockedCount}/{achievements.length}
        </Text>
      </View>
      <View style={s.achGrid}>
        {achievements.map((a) => (
          <View
            key={a.id}
            style={[s.achCard, !a.unlocked && s.achCardLocked]}
            testID={`ach-${a.id}${a.unlocked ? '-unlocked' : '-locked'}`}
          >
            <View style={[s.achIcon, { backgroundColor: a.unlocked ? a.color + '22' : '#F3F4F6' }]}>
              <Ionicons name={a.icon as any} size={20} color={a.unlocked ? a.color : '#D1D5DB'} />
            </View>
            <Text style={[s.achTitle, !a.unlocked && s.achTitleLocked]} numberOfLines={2}>
              {a.title}
            </Text>
          </View>
        ))}
      </View>

      {/* G. Коментар тренера */}
      {coachComment && (
        <>
          <Text style={s.sectionLabel}>КОМЕНТАР ТРЕНЕРА</Text>
          <View style={s.coachCard} testID="coach-comment">
            <View style={s.coachAvatar}>
              <Ionicons name="person" size={18} color="#7C3AED" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={s.coachName}>{junior?.coachName || 'Тренер'}</Text>
              <Text style={s.coachText}>"{coachComment}"</Text>
            </View>
          </View>
        </>
      )}

      {/* H. Змагальний прогрес */}
      <Text style={s.sectionLabel}>ЗМАГАЛЬНИЙ ПРОГРЕС</Text>
      <View testID="comp-progress">
        {upcomingComps.length > 0 ? (
          upcomingComps.slice(0, 2).map((c: any, i: number) => (
            <View key={i} style={s.compItem}>
              <Ionicons name="trophy" size={18} color="#F59E0B" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.compItemT}>{c.name}</Text>
                <Text style={s.compItemS}>
                  {c.status === 'REGISTERED' ? 'У списку на турнір' : c.status === 'PREPARING' ? 'Готується до атестації' : c.daysUntil ? `Через ${c.daysUntil} днів` : 'Майбутнє'}
                </Text>
              </View>
            </View>
          ))
        ) : competitions.length > 0 ? (
          competitions.slice(0, 3).map((c: any, i: number) => (
            <View key={i} style={s.compItem}>
              <Text style={s.compMedal}>
                {c.medal === 'gold' ? '🥇' : c.medal === 'silver' ? '🥈' : c.medal === 'bronze' ? '🥉' : '🏆'}
              </Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.compItemT}>{c.name}</Text>
                <Text style={s.compItemS}>
                  {c.place ? `${c.place} місце` : 'Учасник'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={s.compEmpty}>
            <Text style={s.compEmptyT}>Поки не заявлений на турніри</Text>
            <Text style={s.compEmptyS}>
              Продовжуй тренуватись — скоро запросять на атестацію
            </Text>
          </View>
        )}
      </View>
      {/* Contextual Hints */}
      {(discipline < 70 || streak < 3) && (
        <View style={s.hintBox} testID="progress-hint">
          <Ionicons name="bulb" size={16} color="#F59E0B" />
          <Text style={s.hintT}>
            {discipline < 70
              ? 'Треба ходити частіше — це швидко підніме дисципліну'
              : `Ще ${Math.max(1, 3 - streak)} тренування до бейджу "Стабільний"`}
          </Text>
        </View>
      )}

      {/* CTAs */}
      <View style={s.ctaRow}>
        <TouchableOpacity
          testID="progress-cta-confirm"
          style={[s.ctaBtn, { backgroundColor: '#E30613' }]}
          onPress={() => router.push('/(student)/schedule' as any)}
        >
          <Ionicons name="checkmark-circle" size={16} color="#FFF" />
          <Text style={s.ctaT}>Записатися на тренування</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="progress-cta-schedule"
          style={[s.ctaBtn, { backgroundColor: '#F3F4F6' }]}
          onPress={() => router.push('/(student)/schedule' as any)}
        >
          <Ionicons name="calendar" size={16} color="#0F0F10" />
          <Text style={[s.ctaT, { color: '#0F0F10' }]}>Подивитись розклад</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
    flex: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionCounter: { fontSize: 13, fontWeight: '800', color: '#0F0F10', marginTop: 20 },

  // A-B. Belt hero
  beltHero: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  beltTrack: { flexDirection: 'row', alignItems: 'center' },
  beltNode: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  beltNodeT: { fontSize: 20, fontWeight: '800' },
  beltTrackLine: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginHorizontal: 10, overflow: 'hidden' },
  beltTrackFill: { height: 8, borderRadius: 4 },
  beltHeroInfo: { alignItems: 'center', marginTop: 16 },
  beltHeroT: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  beltHeroNum: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  beltHeroRemain: { fontSize: 13, color: '#10B981', fontWeight: '700', marginTop: 4 },

  // C. Discipline
  discCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  discRow: { flexDirection: 'row', alignItems: 'center' },
  discCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#6EE7B7',
  },
  discVal: { fontSize: 24, fontWeight: '800', color: '#065F46' },
  discLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  discLineT: { fontSize: 13, color: '#374151', flex: 1 },
  discBold: { fontWeight: '800', color: '#0F0F10' },

  // D. Streak
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  streakIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFBEB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakEmoji: { fontSize: 28 },
  streakT: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  streakSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  // E. XP
  xpCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  xpHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  xpLvlBadge: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  xpLvlT: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  xpLvlName: { flex: 1, fontSize: 13, color: '#6B7280' },
  xpAmt: { fontSize: 14, fontWeight: '800', color: '#F59E0B' },
  xpBarBg: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  xpBarFill: { height: 8, backgroundColor: '#F59E0B', borderRadius: 4 },
  xpTo: { fontSize: 12, color: '#9CA3AF', marginTop: 6 },

  // F. Achievements
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  achCard: {
    width: '31%',
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  achCardLocked: { opacity: 0.5 },
  achIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  achTitle: { fontSize: 11, fontWeight: '700', color: '#0F0F10', textAlign: 'center', minHeight: 28 },
  achTitleLocked: { color: '#9CA3AF' },

  // G. Coach comment
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  coachAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coachName: { fontSize: 13, fontWeight: '800', color: '#5B21B6' },
  coachText: { fontSize: 13, color: '#4B5563', marginTop: 4, fontStyle: 'italic' },

  // H. Competition progress
  compItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  compMedal: { fontSize: 22 },
  compItemT: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  compItemS: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  compEmpty: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  compEmptyT: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  compEmptyS: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  // Contextual hint
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  hintT: { flex: 1, fontSize: 13, color: '#92400E', fontWeight: '600' },

  // CTAs
  ctaRow: { flexDirection: 'column', gap: 8, marginTop: 20 },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  ctaT: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
