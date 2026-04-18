import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

export default function OwnerDashboard() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const [data, setData] = useState<any>(null);
  const [revenue, setRevenue] = useState<any>(null);
  const [cashflow, setCashflow] = useState<any>(null);
  const [debtors, setDebtors] = useState<any>(null);
  const [conversion, setConversion] = useState<any>(null);
  const [clubs, setClubs] = useState<any[]>([]);
  const [activeClub, setActiveClub] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [financial, setFinancial] = useState<any>(null);
  const [coachRoi, setCoachRoi] = useState<any>(null);
  // ═══ CONTROL TOWER NEW BLOCKS ═══
  const [moneyNow, setMoneyNow] = useState<any>(null);
  const [riskToday, setRiskToday] = useState<any>(null);
  const [falling, setFalling] = useState<any>(null);
  // ═══ X10 FINAL ═══
  const [microInsight, setMicroInsight] = useState<any>(null);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [showClubPicker, setShowClubPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [clubRes, revRes, cfRes, debtRes, convRes, clubsRes, insRes, roiRes, moneyRes, riskRes, fallRes] = await Promise.allSettled([
        api.get('/owner/club'),
        api.get('/owner/revenue-breakdown'),
        api.get('/owner/cashflow'),
        api.get('/owner/debtors'),
        api.get('/owner/conversion'),
        api.get('/owner/clubs'),
        api.get('/owner/insights'),
        api.get('/owner/coach-roi'),
        api.get('/owner/money-now'),
        api.get('/owner/risk-today'),
        api.get('/owner/falling'),
      ]);
      if (clubRes.status === 'fulfilled') { setData(clubRes.value.data || clubRes.value); setActiveClub(clubRes.value.data?.club || clubRes.value.club || clubRes.value); }
      if (revRes.status === 'fulfilled') setRevenue(revRes.value.data || revRes.value);
      if (cfRes.status === 'fulfilled') setCashflow(cfRes.value.data || cfRes.value);
      if (debtRes.status === 'fulfilled') setDebtors(debtRes.value.data || debtRes.value);
      if (convRes.status === 'fulfilled') setConversion(convRes.value.data || convRes.value);
      if (clubsRes.status === 'fulfilled') setClubs((clubsRes.value.data || clubsRes.value)?.clubs || []);
      if (insRes.status === 'fulfilled') setInsights((insRes.value.data || insRes.value)?.insights || []);
      if (roiRes.status === 'fulfilled') setCoachRoi(roiRes.value.data || roiRes.value);
      if (moneyRes.status === 'fulfilled') setMoneyNow(moneyRes.value.data || moneyRes.value);
      if (riskRes.status === 'fulfilled') setRiskToday(riskRes.value.data || riskRes.value);
      if (fallRes.status === 'fulfilled') setFalling(fallRes.value.data || fallRes.value);
      try {
        const miRes: any = await api.get('/owner/micro-insight');
        setMicroInsight(miRes.data || miRes);
      } catch {}
      try {
        const finRes = await api.get('/owner/financial-breakdown');
        setFinancial(finRes.data || finRes);
      } catch {}
    } catch (e) { console.error('Owner dashboard error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const club = activeClub?.club || activeClub || {};
  const stats = data?.stats || {};
  const limits = data?.limits || {};

  // ═══ MASS ACTIONS ═══
  const massMessage = async () => {
    const kids = (riskToday?.students || []).map((x: any) => x.childId);
    if (kids.length === 0) {
      Alert.alert('Немає учнів у ризику', 'Нікого повідомляти не потрібно сьогодні.');
      return;
    }
    Alert.alert(
      `Написати ${kids.length} батькам?`,
      'Відправимо повідомлення-нагадування про сьогоднішнє тренування.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відправити',
          style: 'destructive',
          onPress: async () => {
            try {
              const r = await api.post('/owner/mass-message', {
                childIds: kids,
                text: 'Нагадуємо: сьогодні тренування для {name}. Чекаємо на вас!',
              });
              Alert.alert('Відправлено', `Повідомлень: ${r.sent}, push: ${r.pushSent}`);
              fetchData();
            } catch { Alert.alert('Помилка відправки'); }
          },
        },
      ]
    );
  };

  const massReschedule = async () => {
    const kids = (riskToday?.students || []).map((x: any) => x.childId);
    if (kids.length === 0) {
      Alert.alert('Немає учнів у ризику', 'Нічого переносити.');
      return;
    }
    Alert.alert(
      `Запропонувати перенесення ${kids.length} учням?`,
      'Батьки отримають пропозицію обрати новий час.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Запропонувати',
          onPress: async () => {
            try {
              const r = await api.post('/owner/mass-reschedule', {
                childIds: kids,
                reason: 'Ми помітили, що вам важко прийти сьогодні. Оберіть зручний час.',
              });
              Alert.alert('Відправлено', `Пропозицій: ${r.sent}, push: ${r.pushSent}`);
              fetchData();
            } catch { Alert.alert('Помилка'); }
          },
        },
      ]
    );
  };

  // ═══ SINGLE-STUDENT ACTIONS (quick actions on risk rows) ═══
  const singleMessage = async (childId: string, childName: string) => {
    Alert.alert(
      `Написати батькам ${childName}?`,
      'Відправимо особисте нагадування про сьогоднішнє тренування.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відправити',
          onPress: async () => {
            try {
              await api.post('/owner/mass-message', {
                childIds: [childId],
                text: `Нагадуємо: сьогодні тренування для {name}. Чекаємо на вас!`,
              });
              Alert.alert('✓ Відправлено', `Повідомлення надіслано батькам ${childName}.`);
              fetchData();
            } catch { Alert.alert('Помилка відправки'); }
          },
        },
      ]
    );
  };

  const singleReschedule = async (childId: string, childName: string) => {
    Alert.alert(
      `Перенести тренування ${childName}?`,
      'Батьки отримають пропозицію обрати новий зручний час.',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Запропонувати',
          onPress: async () => {
            try {
              await api.post('/owner/mass-reschedule', {
                childIds: [childId],
                reason: 'Оберіть інший зручний час для тренування.',
              });
              Alert.alert('✓ Відправлено', `Пропозиція надіслана батькам ${childName}.`);
              fetchData();
            } catch { Alert.alert('Помилка'); }
          },
        },
      ]
    );
  };

  const openStudent = (childId: string) => {
    router.push(`/student/${childId}` as any);
  };

  // ═══ X10: ВИРІШИТИ ВСЕ — unified resolve ═══
  const resolveAll = async (action: 'message' | 'reschedule' | 'collect') => {
    setResolving(true);
    try {
      const res: any = await api.post('/owner/resolve-all', { action });
      const data = res?.data || res;
      setResolveModalOpen(false);
      const label =
        action === 'message' ? 'Повідомлено' :
        action === 'reschedule' ? 'Перенос запропоновано' : 'Нагадування про борг надіслано';
      Alert.alert(`✓ ${label}`, `${data.sent || 0} з ${data.targeted || 0} отримали повідомлення.`);
      fetchData();
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалось виконати дію.');
    } finally {
      setResolving(false);
    }
  };

  return (
    <ScrollView style={s.container} contentContainerStyle={s.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}>
      {/* Hero Card — АТАКА Київ · Owner · PRO · ACTIVE */}
      <View style={s.heroCard} testID="owner-hero">
        <View style={s.heroTopRow}>
          <Text style={s.heroClub} numberOfLines={1}>{club.name || 'Мій клуб'}</Text>
          <View style={s.heroPlanRow}>
            <View style={s.planBadge}><Text style={s.planText}>{club.plan || 'PRO'}</Text></View>
            <View style={s.statusDot} />
            <Text style={s.heroStatus}>{club.saasStatus || 'ACTIVE'}</Text>
          </View>
        </View>
        <Text style={s.heroRole}>Owner · {(user as any)?.firstName || ''} {(user as any)?.lastName || ''}</Text>
      </View>

      {/* ═══════════════════════════════════════════ */}
      {/* БЛОК 1: ГРОШІ ЗАРАЗ                        */}
      {/* ═══════════════════════════════════════════ */}
      {moneyNow && (
        <>
          <View style={s.sectionHeaderRow}>
            <Ionicons name="flash" size={20} color="#E30613" />
            <Text style={s.bigSectionTitle}>ГРОШІ ЗАРАЗ</Text>
          </View>
          {/* MAIN KPI - Очікується (big) */}
          <View style={s.moneyNowHero} testID="money-now-hero">
            <Text style={s.moneyNowHeroLabel}>Очікується сьогодні</Text>
            <Text style={s.moneyNowHeroValue}>+{(moneyNow.expected?.amount || 0).toLocaleString()} ₴</Text>
            <Text style={s.moneyNowHeroSub}>{moneyNow.expected?.count || 0} платежів</Text>
          </View>
          {/* 2 secondary KPIs */}
          <View style={s.moneyNowRow} testID="money-now-block">
            <View style={[s.moneyNowSec, { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="warning" size={14} color="#F59E0B" />
              <Text style={s.moneyNowSecLabel}>Під ризиком</Text>
              <Text style={[s.moneyNowSecValue, { color: '#F59E0B' }]}>-{(moneyNow.atRisk?.amount || 0).toLocaleString()} ₴</Text>
              <Text style={s.moneyNowSecSub}>{moneyNow.atRisk?.count || 0} учнів</Text>
            </View>
            <View style={[s.moneyNowSec, { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="close-circle" size={14} color="#DC2626" />
              <Text style={s.moneyNowSecLabel}>Вже втрачено</Text>
              <Text style={[s.moneyNowSecValue, { color: '#DC2626' }]}>-{(moneyNow.alreadyLost?.amount || 0).toLocaleString()} ₴</Text>
              <Text style={s.moneyNowSecSub}>{moneyNow.alreadyLost?.count || 0} пропусків</Text>
            </View>
          </View>

          {/* ═══ X10 FINAL: MICRO-INSIGHT (one-liner AI brain) ═══ */}
          {microInsight?.insight ? (
            <View
              style={[
                s.microInsightCard,
                microInsight.insight.level === 'danger' && { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
                microInsight.insight.level === 'warning' && { borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
                microInsight.insight.level === 'positive' && { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
              ]}
              testID="micro-insight-card"
            >
              <Ionicons
                name={microInsight.insight.icon || 'bulb'}
                size={18}
                color={
                  microInsight.insight.level === 'danger' ? '#DC2626' :
                  microInsight.insight.level === 'warning' ? '#F59E0B' :
                  microInsight.insight.level === 'positive' ? '#10B981' : '#6B7280'
                }
              />
              <View style={{ flex: 1 }}>
                <Text style={s.microInsightText}>{microInsight.insight.text}</Text>
                {microInsight.insight.actionHint ? (
                  <Text style={s.microInsightHint}>{microInsight.insight.actionHint}</Text>
                ) : null}
              </View>
            </View>
          ) : null}
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* БЛОК 2: РИЗИК СЬОГОДНІ                     */}
      {/* ═══════════════════════════════════════════ */}
      {riskToday && riskToday.count > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Ionicons name="warning" size={20} color="#DC2626" />
            <Text style={s.bigSectionTitle}>РИЗИК СЬОГОДНІ</Text>
            <View style={s.riskCountBadge}><Text style={s.riskCountBadgeText}>{riskToday.count}</Text></View>
          </View>
          <View style={s.riskTodayCard} testID="risk-today-block">
            <Text style={s.riskTodayHeader}>
              {riskToday.count} учнів можуть не прийти · ≈ -{(riskToday.totalLostAmount || 0).toLocaleString()} ₴
            </Text>
            {(riskToday.students || []).slice(0, 5).map((st: any, i: number) => (
              <TouchableOpacity
                key={st.childId}
                style={s.riskStudentRow}
                testID={`risk-student-${i}`}
                onPress={() => openStudent(st.childId)}
                activeOpacity={0.7}
              >
                <View style={s.riskAvatar}>
                  <Text style={s.riskAvatarText}>{(st.name || '?').charAt(0)}</Text>
                </View>
                <View style={s.riskStudentInfo}>
                  <Text style={s.riskStudentName}>{st.name}</Text>
                  <Text style={s.riskStudentReason}>{st.riskReason} · {st.coachName || 'тренер'}</Text>
                </View>
                <View style={s.riskActionsRow}>
                  <TouchableOpacity
                    testID={`risk-msg-${i}`}
                    style={s.riskIconBtn}
                    onPress={(e) => { e.stopPropagation(); singleMessage(st.childId, st.name); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#3B82F6" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID={`risk-resched-${i}`}
                    style={s.riskIconBtn}
                    onPress={(e) => { e.stopPropagation(); singleReschedule(st.childId, st.name); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="calendar-outline" size={16} color="#F59E0B" />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
            {riskToday.count > 5 && (
              <Text style={s.riskMoreText}>ще {riskToday.count - 5}…</Text>
            )}

            {/* ═══ X10 FINAL: mass actions + ВИРІШИТИ ВСЕ ═══ */}
            <View style={s.massActionsRow}>
              <TouchableOpacity testID="mass-message-btn" style={[s.massActionBtn, s.massActionPrimary]} onPress={massMessage}>
                <Ionicons name="flame" size={16} color="#FFF" />
                <Text style={s.massActionText}>🔥 Повернути</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="mass-reschedule-btn" style={[s.massActionBtn, s.massActionSecondary]} onPress={massReschedule}>
                <Ionicons name="calendar" size={16} color="#0F0F10" />
                <Text style={[s.massActionText, { color: '#0F0F10' }]}>📅 Врятувати</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              testID="resolve-all-btn"
              style={s.resolveAllBtn}
              onPress={() => setResolveModalOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="flash" size={18} color="#FFF" />
              <Text style={s.resolveAllBtnText}>ВИРІШИТИ ВСЕ</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ЩО ПОТРЕБУЄ УВАГИ — strictly action-only */}
      {/* ═══════════════════════════════════════════ */}
      {insights.length > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Ionicons name="bulb" size={20} color="#F59E0B" />
            <Text style={s.bigSectionTitle}>ЩО ПОТРЕБУЄ УВАГИ</Text>
            <View style={s.riskCountBadge}><Text style={s.riskCountBadgeText}>{insights.length}</Text></View>
          </View>
          <View style={s.actionStack}>
            {insights.slice(0, 6).map((ins: any, i: number) => {
              const levelColor = ins.level === 'high' ? '#DC2626' : ins.level === 'medium' ? '#F59E0B' : ins.level === 'positive' ? '#10B981' : '#6B7280';
              const levelBg = ins.level === 'high' ? '#FEF2F2' : ins.level === 'medium' ? '#FFFBEB' : ins.level === 'positive' ? '#F0FDF4' : '#F9FAFB';
              const onAction = () => {
                const map: Record<string, () => void> = {
                  OPEN_FINANCE: () => router.push('/(owner)/finance' as any),
                  OPEN_DEBTORS: () => router.push('/(owner)/finance' as any),
                  OPEN_LEADS: () => router.push('/admin/leads' as any),
                  UPGRADE_PLAN: () => router.push('/(owner)/club' as any),
                  OPEN_MARKETPLACE: () => router.push('/(owner)/marketplace' as any),
                  OPEN_RETENTION: () => router.push('/admin/retention' as any),
                  OPEN_TEAM: () => router.push('/(owner)/team' as any),
                };
                const fn = map[ins.action];
                if (fn) fn();
              };
              return (
                <View key={i} style={[s.actionCardRow, { backgroundColor: levelBg, borderColor: levelColor + '33' }]} testID={`insight-${ins.type}`}>
                  <View style={[s.actionCardDot, { backgroundColor: levelColor }]} />
                  <Text style={s.actionCardText} numberOfLines={2}>{ins.message}</Text>
                  {ins.action && ins.action !== 'NONE' ? (
                    <TouchableOpacity style={[s.actionCardBtn, { backgroundColor: levelColor }]} onPress={onAction} activeOpacity={0.85}>
                      <Text style={s.actionCardBtnText}>{ins.actionLabel || 'Дія'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ТРЕНЕРИ = ГРОШІ — simplified                */}
      {/* ═══════════════════════════════════════════ */}
      {coachRoi && (coachRoi.coaches || []).length > 0 && (
        <>
          <View style={s.sectionHeaderRow}>
            <Ionicons name="fitness" size={20} color="#8B5CF6" />
            <Text style={s.bigSectionTitle}>ТРЕНЕРИ = ГРОШІ</Text>
          </View>
          {(coachRoi.coaches || []).map((c: any, i: number) => {
            const isTop = c.conversion >= 60 || (c.revenueImpact || 0) > 10000;
            const isWeak = c.conversion < 30 && c.contacted > 0;
            const tagText = isTop ? 'Топ тренер' : isWeak ? 'Слабкий результат' : 'Потрібна увага';
            const tagBg = isTop ? '#D1FAE5' : isWeak ? '#FEE2E2' : '#FFFBEB';
            const tagFg = isTop ? '#065F46' : isWeak ? '#991B1B' : '#92400E';
            return (
              <TouchableOpacity
                key={i}
                style={s.coachRoiCard}
                testID={`coach-roi-${i}`}
                onPress={() => router.push(`/coach-profile/${c.id}` as any)}
                activeOpacity={0.85}
              >
                <View style={[s.coachAvatar, { backgroundColor: isTop ? '#D1FAE5' : isWeak ? '#FEE2E2' : '#FEF3C7' }]}>
                  <Ionicons name="person" size={20} color={isTop ? '#10B981' : isWeak ? '#EF4444' : '#F59E0B'} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.coachName} numberOfLines={1}>{c.name}</Text>
                  <Text style={s.coachMeta} numberOfLines={1}>{c.studentsCount || 0} учнів · конв. {c.conversion || 0}%</Text>
                  <View style={[s.coachTag, { backgroundColor: tagBg }]}>
                    <Text style={[s.coachTagText, { color: tagFg }]}>{tagText}</Text>
                  </View>
                </View>
                <View style={s.coachRightCol}>
                  <Text style={[s.coachImpact, { color: (c.revenueImpact || 0) > 0 ? '#10B981' : '#6B7280' }]}>
                    +{(c.revenueImpact || 0).toLocaleString()} ₴
                  </Text>
                  <View style={s.coachControlPill}>
                    <Text style={s.coachControlText}>Контролювати</Text>
                    <Ionicons name="arrow-forward" size={12} color="#FFF" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ВТРАТИ — red block (боль = деньги) — AGGRESSIVE */}
      {/* ═══════════════════════════════════════════ */}
      {coachRoi && (coachRoi.losses || []).length > 0 && (
        <>
          <View style={s.lossesHeader} testID="losses-header">
            <Ionicons name="trending-down" size={18} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={s.lossesHeaderTitle}>ТИ ВЖЕ ВТРАТИВ СЬОГОДНІ</Text>
              <Text style={s.lossesHeaderAmount}>
                -{(coachRoi.losses.reduce((sum: number, l: any) => sum + (l.amount || 0), 0)).toLocaleString()} ₴
              </Text>
              <Text style={s.lossesHeaderMeta}>
                {coachRoi.losses.length} {coachRoi.losses.length === 1 ? 'учень не прийшов' : 'учнів не прийшли'}
                {moneyNow?.alreadyLost?.count > 0 ? ` · ${moneyNow.alreadyLost.count} пропусків` : ''}
              </Text>
            </View>
          </View>
          {coachRoi.losses.map((l: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={s.lossCard}
              testID={`loss-${i}`}
              activeOpacity={0.85}
              onPress={() => l.childId && router.push(`/student/${l.childId}` as any)}
            >
              <View style={s.lossIcon}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.lossName} numberOfLines={1}>{l.name || l.childName || 'Учень'}</Text>
                <Text style={s.lossReason} numberOfLines={1}>{l.reason || `${l.misses || 0} пропусків · ${l.coachName || 'тренер'}`}</Text>
              </View>
              <Text style={s.lossAmount}>-{(l.amount || 0).toLocaleString()} ₴</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: 40 }} />

      {/* ═══ X10: RESOLVE-ALL MODAL ═══ */}
      <Modal visible={resolveModalOpen} animationType="slide" transparent onRequestClose={() => setResolveModalOpen(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Вирішити все</Text>
            <Text style={s.modalSubtitle}>
              У вас {riskToday?.count || 0} {(riskToday?.count || 0) === 1 ? 'учень' : 'учнів'} в ризику.
              {microInsight?.stats?.debtCount > 0 ? ` ${microInsight.stats.debtCount} ще мають борг ${(microInsight.stats.debtAmount || 0).toLocaleString()} ₴.` : ''}
              {'\n'}Що зробити?
            </Text>

            <TouchableOpacity
              testID="resolve-message-btn"
              style={[s.modalActionBtn, { backgroundColor: '#DC2626' }]}
              onPress={() => resolveAll('message')}
              disabled={resolving}
              activeOpacity={0.85}
            >
              <Ionicons name="flame" size={20} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={s.modalActionTitle}>🔥 Повернути всіх</Text>
                <Text style={s.modalActionSub}>Особисте повідомлення → push батькам</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              testID="resolve-reschedule-btn"
              style={[s.modalActionBtn, { backgroundColor: '#F59E0B' }]}
              onPress={() => resolveAll('reschedule')}
              disabled={resolving}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar" size={20} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={s.modalActionTitle}>📅 Врятувати тренування</Text>
                <Text style={s.modalActionSub}>Батьки оберуть інший зручний час</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              testID="resolve-collect-btn"
              style={[s.modalActionBtn, { backgroundColor: '#10B981' }]}
              onPress={() => resolveAll('collect')}
              disabled={resolving}
              activeOpacity={0.85}
            >
              <Ionicons name="cash" size={20} color="#FFF" />
              <View style={{ flex: 1 }}>
                <Text style={s.modalActionTitle}>💰 Стягнути оплату</Text>
                <Text style={s.modalActionSub}>Нагадати боржникам про сплату</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={s.modalCancel}
              onPress={() => setResolveModalOpen(false)}
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            >
              <Text style={s.modalCancelText}>Скасувати</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  scrollContent: { paddingTop: 8, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  clubSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 12, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  clubSwitcherText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1F2937' },

  // ═══ CONTROL TOWER ═══
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  bigSectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F0F10', letterSpacing: 0.5, flex: 1 },
  riskCountBadge: { backgroundColor: '#DC2626', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  riskCountBadgeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  // БЛОК 1: ГРОШІ ЗАРАЗ
  moneyNowCard: { backgroundColor: '#0F0F10', borderRadius: 18, padding: 16 },
  moneyNowRow: { flexDirection: 'row', gap: 10 },
  moneyNowItem: { flex: 1, backgroundColor: '#1F1F22', borderRadius: 12, padding: 12, borderWidth: 1 },
  moneyNowExpected: { borderColor: 'rgba(16,185,129,0.35)' },
  moneyNowRisk: { borderColor: 'rgba(245,158,11,0.35)' },
  moneyNowLost: { borderColor: 'rgba(239,68,68,0.35)' },
  moneyNowLabel: { fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
  moneyNowValue: { fontSize: 18, fontWeight: '900', marginTop: 6 },
  moneyNowSub: { fontSize: 11, color: '#6B7280', marginTop: 4 },

  // БЛОК 2: РИЗИК СЬОГОДНІ
  riskTodayCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 2, borderColor: '#FECACA' },
  riskTodayHeader: { fontSize: 13, color: '#991B1B', fontWeight: '700', marginBottom: 10 },
  riskStudentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#FEE2E2' },
  riskAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  riskAvatarText: { fontSize: 14, fontWeight: '800', color: '#DC2626' },
  riskStudentInfo: { flex: 1, marginLeft: 10 },
  riskStudentName: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  riskStudentReason: { fontSize: 12, color: '#991B1B', marginTop: 2 },
  riskStudentTime: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  riskActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskIconBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  riskMoreText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 6, fontStyle: 'italic' },
  massActionsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  massActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 12 },
  massActionPrimary: { backgroundColor: '#DC2626' },
  massActionSecondary: { backgroundColor: '#F3F4F6' },
  massActionText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  // ВСІ УЧНІ + БІЗНЕС
  allStudentsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  allStudentsLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  allStudentsTitle: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  allStudentsSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  businessGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  businessCard: { flex: 1, minWidth: '47%', backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  businessTitle: { fontSize: 14, fontWeight: '700', color: '#0F0F10', marginTop: 8 },
  businessSubtitle: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  // БЛОК 3: ПАДІННЯ
  fallingCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#FEE2E2' },
  fallingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  fallingInfo: { flex: 1 },
  fallingLabel: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  fallingDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  fallingChange: { fontSize: 16, fontWeight: '800', color: '#EF4444' },

  insightsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 10 },
  insightsTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  insightsBadge: { backgroundColor: '#F59E0B', borderRadius: 10, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  insightsBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  insightsCard: { borderRadius: 16, overflow: 'hidden' },
  insightItem: { flexDirection: 'row', alignItems: 'center', padding: 14, marginBottom: 6, borderRadius: 12 },
  insightDot: { width: 10, height: 10, borderRadius: 5 },
  insightContent: { flex: 1, marginLeft: 12 },
  insightMessage: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  insightDetail: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  insightAction: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 8 },
  insightActionText: { fontSize: 12, fontWeight: '700' },
  heroCard: { backgroundColor: '#0F0F10', borderRadius: 20, padding: 24, marginTop: 4 },
  heroClub: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroPlanRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 },
  planBadge: { backgroundColor: '#E30613', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  planText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  heroStatus: { fontSize: 14, color: '#10B981', fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginTop: 24, marginBottom: 10 },
  cashflowCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  cashflowRow: { flexDirection: 'row' },
  cashflowItem: { flex: 1, alignItems: 'center' },
  cashflowDivider: { width: 1, backgroundColor: '#F3F4F6', marginHorizontal: 4 },
  cashflowLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  cashflowValue: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  cashflowSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  pendingText: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
  finCard: { backgroundColor: '#0F0F10', borderRadius: 16, padding: 18, overflow: 'hidden' },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  finLabel: { fontSize: 14, color: '#9CA3AF' },
  finGross: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  finComm: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  finRowTotal: { borderBottomWidth: 0, paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#374151' },
  finTotalLabel: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  finTotalValue: { fontSize: 22, fontWeight: '800', color: '#10B981' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', backgroundColor: '#FFF', borderRadius: 16, padding: 16, alignItems: 'center', flexGrow: 1, flexBasis: '45%', borderWidth: 1, borderColor: '#F3F4F6' },
  metricValue: { fontSize: 22, fontWeight: '800', color: '#0F0F10', marginTop: 6 },
  metricLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  conversionCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  conversionRow: { flexDirection: 'row' },
  conversionItem: { flex: 1, alignItems: 'center' },
  convBigValue: { fontSize: 28, fontWeight: '800', color: '#E30613' },
  convValue: { fontSize: 22, fontWeight: '700', color: '#0F0F10' },
  convLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  debtorsCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  debtorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  debtorRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  debtorRankText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  debtorInfo: { flex: 1, marginLeft: 12 },
  debtorName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  debtorParent: { fontSize: 12, color: '#6B7280' },
  debtorAmount: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  totalDebtRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 4 },
  totalDebtLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  totalDebtValue: { fontSize: 16, fontWeight: '800', color: '#EF4444' },
  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6' },
  actionIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 12, color: '#4B5563', fontWeight: '600', textAlign: 'center' },
  limitsCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  limitRow: { marginBottom: 14 },
  limitInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  limitLabel: { fontSize: 14, color: '#4B5563' },
  limitCount: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  limitBar: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  limitFill: { height: 8, borderRadius: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  clubPickerContent: { backgroundColor: '#FFF', borderRadius: 20, padding: 20 },
  clubPickerTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10', marginBottom: 16 },
  clubPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 6, backgroundColor: '#F9FAFB' },
  clubPickerItemActive: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#E30613' },
  clubPickerName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  clubPickerCity: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  clubPickerRevenue: { fontSize: 16, fontWeight: '700', color: '#10B981' },

  // ═══ X10 SPRINT 1 — NEW STYLES ═══
  scrollContent: { paddingBottom: 40 },

  // Hero redesign
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  heroRole: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6, fontWeight: '500' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34D399', marginLeft: 4 },

  // Гроші зараз — new hero KPI + 2 secondary
  moneyNowHero: { backgroundColor: '#0F0F10', borderRadius: 18, padding: 20, marginBottom: 10 },
  moneyNowHeroLabel: { fontSize: 12, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  moneyNowHeroValue: { fontSize: 38, fontWeight: '900', color: '#10B981', marginTop: 8, letterSpacing: -1 },
  moneyNowHeroSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
  moneyNowSec: { flex: 1, borderRadius: 14, padding: 12, borderWidth: 1 },
  moneyNowSecLabel: { fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  moneyNowSecValue: { fontSize: 20, fontWeight: '900', marginTop: 6, letterSpacing: -0.5 },
  moneyNowSecSub: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  // Action cards (Що потребує уваги)
  actionStack: { gap: 8 },
  actionCardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1 },
  actionCardDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  actionCardText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#0F0F10', lineHeight: 19 },
  actionCardBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  actionCardBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Coach ROI simplified
  coachRoiCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  coachAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  coachName: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  coachMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  coachTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 6 },
  coachTagText: { fontSize: 11, fontWeight: '700' },
  coachRightCol: { alignItems: 'flex-end', gap: 6 },
  coachImpact: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  coachControlPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, backgroundColor: '#8B5CF6' },
  coachControlText: { fontSize: 11, fontWeight: '800', color: '#FFF' },

  // Втрати
  lossCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#FECACA' },
  lossIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  lossName: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  lossReason: { fontSize: 12, color: '#991B1B', marginTop: 2 },
  lossAmount: { fontSize: 16, fontWeight: '900', color: '#DC2626', letterSpacing: -0.3 },


  // ═══ X10 FINAL — 10/10 STYLES ═══
  microInsightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginTop: 10, marginBottom: 4 },
  microInsightText: { fontSize: 14, fontWeight: '700', color: '#0F0F10', lineHeight: 19 },
  microInsightHint: { fontSize: 12, color: '#6B7280', marginTop: 4, fontWeight: '500' },

  resolveAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#0F0F10', borderRadius: 14, paddingVertical: 16, marginTop: 12 },
  resolveAllBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  lossesHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#DC2626', borderRadius: 16, padding: 18, marginTop: 28, marginBottom: 12 },
  lossesHeaderTitle: { fontSize: 12, fontWeight: '900', color: '#FECACA', letterSpacing: 1, textTransform: 'uppercase' },
  lossesHeaderAmount: { fontSize: 30, fontWeight: '900', color: '#FFF', marginTop: 2, letterSpacing: -1 },
  lossesHeaderMeta: { fontSize: 12, color: '#FECACA', marginTop: 2, fontWeight: '500' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34 },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginBottom: 18 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F0F10', marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 18 },
  modalActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, marginBottom: 10 },
  modalActionTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  modalActionSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  modalCancel: { alignSelf: 'center', marginTop: 6, paddingVertical: 10 },
  modalCancelText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },

});
