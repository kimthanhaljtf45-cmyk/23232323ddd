import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { PressScale, FadeInUp, Toast } from '@/components/motion';

const BELT_NAMES: Record<string, string> = { WHITE: 'Білий', YELLOW: 'Жовтий', ORANGE: 'Помаранч.', GREEN: 'Зелений', BLUE: 'Синій', BROWN: 'Коричн.', BLACK: 'Чорний' };

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  OK:      { color: '#065F46', bg: '#ECFDF5', label: 'Ок' },
  WARNING: { color: '#92400E', bg: '#FFFBEB', label: 'Увага' },
  RISK:    { color: '#991B1B', bg: '#FEF2F2', label: 'Ризик' },
  DEBT:    { color: '#991B1B', bg: '#FEF2F2', label: 'Борг' },
};

export default function HomeScreen() {
  const { user } = useStore();
  if (user?.role === 'ADMIN') { router.replace('/(admin)'); return <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>; }
  if (user?.role === 'COACH') { router.replace('/(coach)'); return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>; }
  return <ParentHome />;
}

// ── Header 72 ──────────────────────────────────────────
function Header({ onBell, onAvatar, unread = 0 }: any) {
  return (
    <View style={s.header} testID="parent-header">
      <View style={s.logoRow}>
        <View style={s.logoDot} />
        <Text style={s.logoT}>ATAKA</Text>
      </View>
      <View style={{ flex: 1 }} />
      <PressScale testID="header-bell" style={s.iconBtn as any} onPress={onBell} hitSlop={12}>
        <Ionicons name="notifications-outline" size={22} color="#0F0F10" />
        {unread > 0 && <View style={s.bellDot} />}
      </PressScale>
      <PressScale testID="header-avatar" style={s.avatar as any} onPress={onAvatar} hitSlop={12}>
        <Ionicons name="person" size={18} color="#FFF" />
      </PressScale>
    </View>
  );
}

// ── Priority Block — ONE main action ──────────────────
function PriorityBlock({ block, onAction }: any) {
  if (!block) return null;
  const sev = block.severity || 'info';
  const toneBg =
    sev === 'critical' ? '#991B1B' :
    sev === 'warning'  ? '#D97706' :
    sev === 'success'  ? '#065F46' :
    '#0F0F10';
  const toneShadow =
    sev === 'critical' ? '#991B1B' :
    sev === 'warning'  ? '#D97706' :
    sev === 'success'  ? '#065F46' :
    '#0F0F10';
  return (
    <PressScale testID="priority-block" style={[s.priorityCard, { backgroundColor: toneBg, shadowColor: toneShadow }] as any} onPress={() => onAction(block.ctaAction, block.ctaPayload)}>
      <View style={s.priorityIcon}>
        <Ionicons name={block.icon || 'alert-circle'} size={22} color="#FFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.priorityTitle} numberOfLines={2}>{block.title}</Text>
        {block.subtitle && <Text style={s.prioritySub} numberOfLines={2}>→ {block.subtitle}</Text>}
      </View>
      <View style={s.priorityCta}>
        <Text style={s.priorityCtaT}>{block.ctaLabel}</Text>
        <Ionicons name="chevron-forward" size={16} color="#FFF" />
      </View>
    </PressScale>
  );
}

// ── Child Card — status + primary CTA ─────────────────
function ChildCard({ child, onAction, onContact }: any) {
  const st = STATUS_CFG[child.debt > 0 ? 'DEBT' : (child.status || 'OK')] || STATUS_CFG.OK;
  const belt = BELT_NAMES[child.belt] || child.belt;
  return (
    <View style={s.childCard} testID={`child-${child.id}`}>
      {/* Status row */}
      <View style={s.childTop}>
        <View style={s.childAvatar}><Ionicons name="person" size={20} color="#E30613" /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.childName} numberOfLines={1}>{child.name}</Text>
          <Text style={s.childSub} numberOfLines={1}>
            {child.group || '—'}{child.coachName ? ` · ${child.coachName}` : ''}
          </Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: st.bg }]}>
          <Text style={[s.statusT, { color: st.color }]}>{st.label}</Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.childStatsRow}>
        <View style={s.statCell}>
          <Text style={[s.statV, child.attendance < 60 && { color: '#991B1B' }]}>{child.attendance || 0}%</Text>
          <Text style={s.statL}>Відвід.</Text>
        </View>
        <View style={s.statCell}>
          <Text style={[s.statV, { color: '#F59E0B' }]}>🔥{child.streak || 0}</Text>
          <Text style={s.statL}>Серія</Text>
        </View>
        <View style={s.statCell}>
          <Text style={s.statV} numberOfLines={1}>{belt}</Text>
          <Text style={s.statL}>Пояс</Text>
        </View>
        {child.nextTraining && (
          <View style={s.statCell}>
            <Text style={s.statV}>{child.nextTraining.time}</Text>
            <Text style={s.statL}>Сьогодні</Text>
          </View>
        )}
      </View>

      {/* Primary CTA inside card */}
      {child.primaryCta && (
        <PressScale
          testID={`child-cta-${child.id}`}
          style={[s.childCta, child.debt > 0 && s.childCtaDebt, child.attendance < 60 && !child.debt && s.childCtaWarn] as any}
          onPress={() => onAction(child.primaryCta.action, child.primaryCta.payload)}
        >
          <Text style={s.childCtaT}>{child.primaryCta.label}</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFF" />
        </PressScale>
      )}

      {/* Secondary actions */}
      <View style={s.childSec}>
        <PressScale testID={`child-progress-${child.id}`} style={s.secBtn as any} onPress={() => onAction('open_progress', { childId: child.id })}>
          <Ionicons name="stats-chart" size={14} color="#6B7280" />
          <Text style={s.secT}>Прогрес</Text>
        </PressScale>
        <PressScale testID={`child-contact-${child.id}`} style={s.secBtn as any} onPress={() => onContact(child)}>
          <Ionicons name="chatbubble-ellipses" size={14} color="#6B7280" />
          <Text style={s.secT}>Написати</Text>
        </PressScale>
        <PressScale testID={`child-payments-${child.id}`} style={s.secBtn as any} onPress={() => onAction('open_payments', { childId: child.id })}>
          <Ionicons name="card" size={14} color="#6B7280" />
          <Text style={s.secT}>Оплати</Text>
        </PressScale>
      </View>
    </View>
  );
}

// ── Today block ──────────────────────────────────────
function TodayBlock({ sessions, onAction }: any) {
  if (!sessions?.length) return null;
  return (
    <View style={s.section} testID="today-block">
      <Text style={s.sectionLbl}>СЬОГОДНІ · {sessions.length}</Text>
      {sessions.map((sess: any, i: number) => (
        <View key={i} style={s.todayRow}>
          <Text style={s.todayTime}>{sess.time}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.todayChild}>{sess.childName}</Text>
            <Text style={s.todaySub}>{sess.location || 'Зал'} · {sess.coach || 'Тренер'}</Text>
          </View>
          <PressScale testID={`today-skip-${i}`} style={s.todaySkip as any} onPress={() => onAction('skip', { childId: sess.childId })}>
            <Text style={s.todaySkipT}>Не прийде</Text>
          </PressScale>
        </View>
      ))}
    </View>
  );
}

// ── Finance mini-block ───────────────────────────────
function FinanceBlock({ finance, onPay }: any) {
  if (!finance || !finance.totalDebt || finance.totalDebt <= 0) return null;
  return (
    <PressScale testID="finance-block" style={s.financeCard as any} onPress={onPay}>
      <View style={s.financeIcon}><Ionicons name="card" size={20} color="#991B1B" /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.financeT}>Загальний борг — {finance.totalDebt} ₴</Text>
        <Text style={s.financeS}>
          {finance.childrenWithDebt || 1} дитин{finance.childrenWithDebt === 1 ? 'а' : 'и'} · дедлайн {finance.nextPaymentDate}
        </Text>
      </View>
      <View style={s.financeCta}>
        <Text style={s.financeCtaT}>Оплатити</Text>
      </View>
    </PressScale>
  );
}

// ── Recommended products ─────────────────────────────
function RecommendedBlock({ items, onOpenShop, onProduct }: any) {
  if (!items?.length) return null;
  return (
    <View style={s.section} testID="recommended-block">
      <View style={s.recHead}>
        <Text style={s.sectionLbl}>РЕКОМЕНДОВАНО</Text>
        <PressScale onPress={onOpenShop} testID="open-shop-btn" style={{}}>
          <Text style={s.recAll}>Увесь магазин →</Text>
        </PressScale>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {items.map((p: any, i: number) => (
          <PressScale key={p.id || i} testID={`rec-${i}`} style={s.recTile as any} onPress={() => onProduct(p)}>
            <View style={s.recImg}><Ionicons name="bag-handle" size={24} color="#E30613" /></View>
            <Text style={s.recName} numberOfLines={2}>{p.name}</Text>
            <Text style={s.recReason} numberOfLines={1}>💡 Рекомендує тренер</Text>
            <Text style={s.recPrice}>{p.price} ₴</Text>
          </PressScale>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Parent Home container ────────────────────────────
function ParentHome() {
  const { user } = useStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; text: string; tone?: any; icon?: string }>({ visible: false, text: '' });

  const fetch = async () => {
    try {
      const r: any = await api.get('/parent/home');
      setData(r?.data || r);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { fetch(); }, []);

  const onAction = async (action: string, payload: any = {}) => {
    switch (action) {
      case 'pay':
        setToast({ visible: true, text: '💳 Відкриваємо WayForPay...', tone: 'info', icon: 'card' });
        // navigate to payments
        router.push('/profile/payments' as any);
        break;
      case 'contact_coach': {
        const coach = data?.coachContacts?.find((c: any) => c.id === payload.coachId) || data?.coachContacts?.[0];
        if (coach?.phone) {
          Linking.openURL(`tel:${coach.phone}`);
          setToast({ visible: true, text: `📞 Дзвоник тренеру ${coach.name}`, tone: 'info', icon: 'call' });
        } else {
          setToast({ visible: true, text: 'Контакт тренера недоступний', tone: 'info', icon: 'alert-circle' });
        }
        break;
      }
      case 'confirm':
        try {
          await api.post('/parent/confirm-training', payload);
          setToast({ visible: true, text: '✅ Підтверджено → тренер бачить це', tone: 'success', icon: 'checkmark-circle' });
          fetch();
        } catch {
          setToast({ visible: true, text: 'Не вдалося підтвердити', tone: 'info', icon: 'alert-circle' });
        }
        break;
      case 'skip':
        try {
          await api.post('/parent/absence', { childId: payload.childId, reason: 'Попередили заздалегідь' });
          setToast({ visible: true, text: '📨 Тренер отримав повідомлення', tone: 'soft', icon: 'mail' });
          fetch();
        } catch {
          setToast({ visible: true, text: 'Не вдалося зберегти', tone: 'info', icon: 'alert-circle' });
        }
        break;
      case 'open_schedule':
        router.push('/(tabs)/schedule' as any);
        break;
      case 'open_progress':
        router.push('/(tabs)/progress' as any);
        break;
      case 'open_payments':
        router.push('/profile/payments' as any);
        break;
    }
  };

  const handleContact = (child: any) => {
    const coach = data?.coachContacts?.find((c: any) => c.id === child.coachId) || data?.coachContacts?.[0];
    if (coach?.phone) {
      Linking.openURL(`tel:${coach.phone}`);
    } else {
      setToast({ visible: true, text: 'Номер тренера недоступний', tone: 'info', icon: 'alert-circle' });
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const children = data?.children || [];
  const priorityBlock = data?.priorityBlock;
  const today = data?.today || [];
  const finance = data?.finance;
  const recommendations = data?.recommendations || [];
  const unreadAlerts = (data?.alerts || []).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <Toast visible={toast.visible} text={toast.text} tone={toast.tone} icon={toast.icon} onHide={() => setToast({ visible: false, text: '' })} />
      <Header unread={unreadAlerts} onBell={() => router.push('/(tabs)/feed' as any)} onAvatar={() => router.push('/(tabs)/profile' as any)} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor="#E30613" />}
      >
        {/* Priority Block — single main action */}
        <FadeInUp>
          <PriorityBlock block={priorityBlock} onAction={onAction} />
        </FadeInUp>

        {/* Children cards */}
        <View style={s.section}>
          <Text style={s.sectionLbl}>МОЇ ДІТИ · {children.length}</Text>
          {children.map((c: any, i: number) => (
            <FadeInUp key={c.id} delay={60 + i * 40}>
              <ChildCard child={c} onAction={onAction} onContact={handleContact} />
            </FadeInUp>
          ))}
          {children.length === 0 && (
            <View style={s.emptyCard}>
              <Ionicons name="person-add" size={30} color="#D1D5DB" />
              <Text style={s.emptyT}>Дітей не додано</Text>
            </View>
          )}
        </View>

        {/* Today */}
        <FadeInUp delay={180}>
          <TodayBlock sessions={today} onAction={onAction} />
        </FadeInUp>

        {/* Finance mini */}
        {finance?.totalDebt > 0 && (
          <FadeInUp delay={220}>
            <FinanceBlock finance={finance} onPay={() => onAction('open_payments', {})} />
          </FadeInUp>
        )}

        {/* Recommended */}
        <FadeInUp delay={260}>
          <RecommendedBlock
            items={recommendations}
            onOpenShop={() => router.push('/(tabs)/shop' as any)}
            onProduct={(p: any) => router.push({ pathname: '/(tabs)/shop', params: { productId: p.id } } as any)}
          />
        </FadeInUp>
      </ScrollView>
    </View>
  );
}

const SHADOW_SM = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
};

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },

  // Header 72
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 48,
    height: 72 + 48, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F1F4',
    gap: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E30613' },
  logoT: { fontSize: 18, fontWeight: '900', color: '#0F0F10', letterSpacing: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E30613' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E30613', alignItems: 'center', justifyContent: 'center' },

  // Priority card (big CTA, solid color)
  priorityCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, padding: 16, marginTop: 16,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.28, shadowRadius: 16, elevation: 6,
  },
  priorityIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  priorityTitle: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  prioritySub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 2 },
  priorityCta: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  priorityCtaT: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  // Section
  section: { marginTop: 24 },
  sectionLbl: { fontSize: 11, fontWeight: '800', color: '#6B7280', letterSpacing: 1, marginBottom: 12 },

  // Child card (Level 1)
  childCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 16, marginBottom: 12, ...SHADOW_SM },
  childTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  childAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center' },
  childName: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  childSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusT: { fontSize: 11, fontWeight: '800' },
  childStatsRow: { flexDirection: 'row', gap: 12, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  statCell: { flex: 1, alignItems: 'flex-start' },
  statV: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  statL: { fontSize: 10, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },

  childCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#0F0F10', borderRadius: 12, paddingVertical: 12, marginTop: 14 },
  childCtaDebt: { backgroundColor: '#E30613' },
  childCtaWarn: { backgroundColor: '#D97706' },
  childCtaT: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  childSec: { flexDirection: 'row', gap: 8, marginTop: 8 },
  secBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 10, paddingVertical: 8 },
  secT: { fontSize: 11, fontWeight: '700', color: '#6B7280' },

  // Today
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 14, padding: 14, marginBottom: 8, ...SHADOW_SM },
  todayTime: { fontSize: 14, fontWeight: '800', color: '#0F0F10', minWidth: 56 },
  todayChild: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  todaySub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  todaySkip: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  todaySkipT: { fontSize: 11, color: '#6B7280', fontWeight: '700' },

  // Finance
  financeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFBFA', borderRadius: 14, padding: 14, marginTop: 16, borderWidth: 1, borderColor: '#FECACA' },
  financeIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  financeT: { fontSize: 14, fontWeight: '800', color: '#991B1B' },
  financeS: { fontSize: 11, color: '#B91C1C', marginTop: 2, fontWeight: '600' },
  financeCta: { backgroundColor: '#E30613', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  financeCtaT: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  // Recommended
  recHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  recAll: { fontSize: 12, fontWeight: '800', color: '#E30613' },
  recTile: { width: 140, backgroundColor: '#FFF', borderRadius: 14, padding: 12, ...SHADOW_SM },
  recImg: { width: '100%' as any, height: 80, borderRadius: 10, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  recName: { fontSize: 12, fontWeight: '700', color: '#0F0F10', minHeight: 32 },
  recReason: { fontSize: 10, color: '#F59E0B', fontWeight: '700', marginTop: 4 },
  recPrice: { fontSize: 15, fontWeight: '900', color: '#0F0F10', marginTop: 6 },

  // Empty
  emptyCard: { alignItems: 'center', padding: 30, backgroundColor: '#FFF', borderRadius: 14 },
  emptyT: { color: '#9CA3AF', marginTop: 8, fontSize: 13 },
});
