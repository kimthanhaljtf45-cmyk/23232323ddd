import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

const BELT_NAMES: Record<string, string> = { WHITE: 'Білий', YELLOW: 'Жовтий', ORANGE: 'Помаранч.', GREEN: 'Зелений', BLUE: 'Синій', BROWN: 'Коричн.', BLACK: 'Чорний' };

export default function HomeScreen() {
  const { user } = useStore();
  if (user?.role === 'ADMIN') { router.replace('/(admin)'); return <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>; }
  if (user?.role === 'COACH') { router.replace('/(coach)'); return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>; }
  return <ParentHome />;
}

// ── Event Banner ────────────────────────────────────────
function EventBanner({ event, onAck }: { event: any; onAck: (id: string) => void }) {
  const isHigh = event.priority === 'HIGH';
  const isMedium = event.priority === 'MEDIUM';
  const bgColor = isHigh ? '#FEF2F2' : isMedium ? '#FFFBEB' : '#F0FDF4';
  const borderColor = isHigh ? '#FECACA' : isMedium ? '#FDE68A' : '#BBF7D0';
  const textColor = isHigh ? '#991B1B' : isMedium ? '#78350F' : '#14532D';

  const handlePress = () => {
    if (event.cta?.screen) {
      router.push(event.cta.screen as any);
    }
  };

  const handleAck = () => onAck(event.id);

  return (
    <View testID={`event-banner-${event.type}`} style={[s.eventBanner, { backgroundColor: bgColor, borderColor }]}>
      <View style={s.eventBannerTop}>
        <View style={[s.eventPriorityDot, { backgroundColor: event.color }]} />
        <View style={{ flex: 1 }}>
          <Text style={[s.eventMsg, { color: textColor }]}>{event.message}</Text>
        </View>
        <TouchableOpacity testID={`event-ack-${event.id}`} onPress={handleAck} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close-circle" size={20} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
      <TouchableOpacity testID={`event-cta-${event.type}`} style={[s.eventCtaBtn, { backgroundColor: event.color }]} onPress={handlePress}>
        <Ionicons name={event.cta?.action === 'pay' ? 'card' : event.cta?.action === 'chat' ? 'chatbubble' : 'eye'} size={16} color="#fff" />
        <Text style={s.eventCtaText}>{event.cta?.label || 'Переглянути'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Parent Home ─────────────────────────────────────────
function ParentHome() {
  const { user } = useStore();
  const [data, setData] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventCounts, setEventCounts] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [homeData, eventsData] = await Promise.all([
        api.get('/parent/home'),
        api.get('/parent/events').catch(() => ({ homeEvents: [], counts: {} })),
      ]);
      setData(homeData);
      setEvents(eventsData?.homeEvents || []);
      setEventCounts(eventsData?.counts || {});
    } catch (e) { console.log('Parent home error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const acknowledgeEvent = async (eventId: string) => {
    try {
      await api.post(`/parent/events/${eventId}/ack`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch (e) { console.log('Ack error:', e); }
  };

  const fmt = (v: number) => `${v || 0} ₴`;
  const fmtDate = (v?: string) => {
    if (!v) return '—';
    try { return new Date(v).toLocaleDateString('uk-UA', { day: '2-digit', month: 'long' }); }
    catch { return '—'; }
  };

  if (loading || !data) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const children = data.children || [];
  const today = data.today || [];
  const alerts = data.alerts || [];
  const finance = data.finance || {};
  const coaches = data.coachContacts || [];
  const competitions = data.competitions || [];
  const recs = data.recommendations || [];

  // Merge events into alerts (events take priority)
  const eventTypes = new Set(events.map(e => e.type));
  const filteredAlerts = alerts.filter((a: any) => {
    if (a.type === 'debt' && eventTypes.has('debt_reminder')) return false;
    if (a.type === 'attendance' && eventTypes.has('attendance_risk')) return false;
    return true;
  });

  const startChat = async (coachId: string, childId?: string) => {
    try {
      const res = await api.post('/parent/chat/start', { coachId, childId });
      if (res.threadId) router.push(`/messages/${res.threadId}` as any);
      else router.push('/messages' as any);
    } catch { router.push('/messages' as any); }
  };

  // Determine if we should show urgent CTA (event-driven)
  const hasHighEvent = events.some(e => e.priority === 'HIGH');
  const hasMediumEvent = events.some(e => e.priority === 'MEDIUM');

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#E30613" />}
      showsVerticalScrollIndicator={false}>

      {/* GREETING with event badge */}
      <View testID="parent-header" style={s.greeting}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={s.greetText}>Привіт, {data.parent?.name || user?.firstName}!</Text>
            <Text style={s.greetSub}>Кабінет батьків</Text>
          </View>
          {(eventCounts.high > 0 || eventCounts.medium > 0) && (
            <TouchableOpacity testID="notifications-badge" style={s.notifBadge} onPress={() => router.push('/notifications' as any)}>
              <Ionicons name="notifications" size={22} color="#0F172A" />
              <View style={s.notifDot}>
                <Text style={s.notifDotT}>{(eventCounts.high || 0) + (eventCounts.medium || 0)}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── EVENT ENGINE BANNERS ── */}
      {events.length > 0 && (
        <View style={s.section}>
          {events.map((ev: any) => (
            <EventBanner key={ev.id} event={ev} onAck={acknowledgeEvent} />
          ))}
        </View>
      )}

      {/* REMAINING ALERTS (not covered by events) */}
      {filteredAlerts.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>УВАГА</Text>
          {filteredAlerts.map((a: any, i: number) => {
            const isCrit = a.severity === 'critical';
            const isDebt = a.type === 'debt';
            return (
              <TouchableOpacity key={i} testID={`alert-${i}`}
                style={[s.alertCard, isCrit ? { borderColor: '#FECACA', backgroundColor: '#FEF2F2' } : { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' }]}
                onPress={() => isDebt ? router.push('/payments' as any) : (a.childId && a.coachId ? startChat(a.coachId, a.childId) : router.push('/(tabs)/progress' as any))}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={isCrit ? 'alert-circle' : 'warning'} size={18} color={isCrit ? '#DC2626' : '#D97706'} />
                  <Text style={[s.alertText, isCrit && { color: '#991B1B' }]}>{a.message}</Text>
                </View>
                <View style={[s.alertBtn, isDebt ? { backgroundColor: '#DC2626' } : { backgroundColor: '#D97706' }]}>
                  <Text style={s.alertBtnT}>{isDebt ? 'Оплатити' : 'Написати'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* CHILDREN — with Event-driven Smart CTA */}
      <View style={s.section}>
        <Text style={s.label}>ДІТИ</Text>
        {children.map((c: any) => {
          // Check if this child has an active event
          const childDebtEvent = events.find(e => e.type === 'debt_reminder' && e.childId === c.id);
          const childRiskEvent = events.find(e => e.type === 'attendance_risk' && e.childId === c.id);

          // Event-driven status override
          const statusColor = childDebtEvent ? '#DC2626' : childRiskEvent ? '#D97706' : c.status === 'RISK' ? '#DC2626' : c.status === 'WARNING' ? '#D97706' : '#16A34A';
          const statusBg = childDebtEvent ? '#FEE2E2' : childRiskEvent ? '#FEF3C7' : c.status === 'RISK' ? '#FEE2E2' : c.status === 'WARNING' ? '#FEF3C7' : '#DCFCE7';
          const statusLabel = childDebtEvent ? 'Борг' : childRiskEvent ? 'Ризик' : c.status === 'RISK' ? 'Ризик' : c.status === 'WARNING' ? 'Увага' : 'Ок';

          // Event-driven Smart CTA
          let mainCta: { label: string; color: string; icon: string; onPress: () => void; pulse?: boolean };
          if (childDebtEvent) {
            mainCta = { label: `Оплатити ${fmt(childDebtEvent.meta?.debt || c.debt)}`, color: '#DC2626', icon: 'card', onPress: () => router.push('/payments' as any), pulse: true };
          } else if (c.debt > 0) {
            mainCta = { label: `Оплатити ${fmt(c.debt)}`, color: '#DC2626', icon: 'card', onPress: () => router.push('/payments' as any) };
          } else if (childRiskEvent) {
            mainCta = { label: 'Написати тренеру', color: '#D97706', icon: 'chatbubble', onPress: () => c.coachId && startChat(c.coachId, c.id), pulse: true };
          } else if (c.status === 'RISK') {
            mainCta = { label: 'Покращити відвідування', color: '#D97706', icon: 'fitness', onPress: () => router.push('/(tabs)/progress' as any) };
          } else {
            mainCta = { label: 'Написати тренеру', color: '#E30613', icon: 'chatbubble', onPress: () => c.coachId && startChat(c.coachId, c.id) };
          }

          return (
            <View testID={`child-card-${c.id}`} key={c.id} style={[s.childCard, mainCta.pulse && { borderColor: statusColor, borderWidth: 2 }]}>
              <View style={s.childTop}>
                <View style={s.childAv}><Text style={s.childAvT}>{c.name?.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.childName}>{c.name}</Text>
                  <Text style={s.childMeta}>{c.group} • {c.coachName}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: statusBg }]}>
                  <Text style={[s.badgeT, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>

              {/* Stats */}
              <View style={s.childStats}>
                <View style={s.stat}><Text style={s.statVal}>{c.attendance}%</Text><Text style={s.statLbl}>Відвідув.</Text></View>
                <View style={s.statDiv} />
                <View style={s.stat}>
                  <Text style={s.statVal}>{c.streak > 0 ? `🔥 ${c.streak}` : '0'}</Text>
                  <Text style={s.statLbl}>Серія</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.stat}><Text style={s.statVal}>{BELT_NAMES[c.belt] || '—'}</Text><Text style={s.statLbl}>Пояс</Text></View>
              </View>

              {/* Training */}
              {c.nextTraining && (
                <View style={s.childTraining}>
                  <Ionicons name="time-outline" size={14} color="#6B7280" />
                  <Text style={s.childTrainT}>Сьогодні: {c.nextTraining.time} — {c.nextTraining.location}</Text>
                </View>
              )}

              {/* EVENT-DRIVEN SMART CTA */}
              <TouchableOpacity testID={`smart-cta-${c.id}`} style={[s.smartCta, { backgroundColor: mainCta.color }]} onPress={mainCta.onPress}>
                <Ionicons name={mainCta.icon as any} size={18} color="#fff" />
                <Text style={s.smartCtaT}>{mainCta.label}</Text>
                {mainCta.pulse && <View style={s.pulseDot} />}
              </TouchableOpacity>

              {/* Secondary actions */}
              <View style={s.childActions}>
                <TouchableOpacity testID={`child-progress-${c.id}`} style={s.childBtn} onPress={() => router.push('/(tabs)/progress' as any)}>
                  <Ionicons name="trending-up" size={14} color="#6B7280" />
                  <Text style={s.childBtnT}>Прогрес</Text>
                </TouchableOpacity>
                {c.coachId && c.debt <= 0 && (
                  <TouchableOpacity testID={`child-msg-${c.id}`} style={s.childBtn} onPress={() => startChat(c.coachId, c.id)}>
                    <Ionicons name="chatbubble-outline" size={14} color={childRiskEvent ? '#D97706' : '#6B7280'} />
                    <Text style={[s.childBtnT, childRiskEvent && { color: '#D97706', fontWeight: '700' }]}>Написати</Text>
                  </TouchableOpacity>
                )}
                {c.debt > 0 && (
                  <TouchableOpacity testID={`child-pay-${c.id}`} style={s.childBtn} onPress={() => router.push('/payments' as any)}>
                    <Ionicons name="card-outline" size={14} color="#6B7280" />
                    <Text style={s.childBtnT}>Історія оплат</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* TODAY */}
      {today.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>СЬОГОДНІ</Text>
          <View style={s.todayCard}>
            {today.map((t: any, i: number) => (
              <TouchableOpacity key={i} style={[s.todayRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]} onPress={() => router.push('/(tabs)/schedule')}>
                <View style={s.todayTime}><Text style={s.todayTimeT}>{t.time}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.todayName}>{t.childName}</Text>
                  <Text style={s.todayLoc}>{t.location} • {t.group}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* COACH */}
      {coaches.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>ТРЕНЕР</Text>
          {coaches.map((c: any) => (
            <TouchableOpacity key={c.id} style={s.coachCard} activeOpacity={0.8} onPress={() => router.push(`/coach-profile/${c.id}` as any)}>
              <View style={s.coachAv}><Text style={s.coachAvT}>{c.name?.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.coachName}>{c.name}</Text>
                  <View style={s.onlineDot} />
                  <Text style={s.onlineText}>Онлайн</Text>
                </View>
                <Text style={s.coachRole}>Тренер • Натисніть для профілю</Text>
              </View>
              <TouchableOpacity testID={`coach-msg-${c.id}`} style={s.coachBtn} onPress={() => startChat(c.id)}>
                <Ionicons name="chatbubble-outline" size={18} color="#E30613" />
              </TouchableOpacity>
              {c.phone && (
                <TouchableOpacity testID={`coach-call-${c.id}`} style={s.coachBtn} onPress={() => Linking.openURL(`tel:${c.phone}`)}>
                  <Ionicons name="call-outline" size={18} color="#16A34A" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* FINANCE — Event-driven urgency */}
      <View style={s.section}>
        <Text style={s.label}>ФІНАНСИ</Text>
        <View style={[s.finCard, hasHighEvent && { borderColor: '#FECACA', borderWidth: 2 }]}>
          <View style={s.finRow}>
            <Text style={s.finLbl}>Загальний борг</Text>
            <Text style={[s.finVal, finance.totalDebt > 0 && { color: '#DC2626', fontWeight: '800' as const }]}>{fmt(finance.totalDebt)}</Text>
          </View>
          {(finance.perChild || []).map((pc: any) => (
            <View key={pc.childId}>
              <View style={s.finDiv} />
              <View style={s.finRow}>
                <Text style={s.finLbl}>{pc.childName}</Text>
                <Text style={[s.finVal, pc.debt > 0 ? { color: '#DC2626' } : { color: '#16A34A' }]}>
                  {pc.debt > 0 ? `Борг ${fmt(pc.debt)}` : pc.subscriptionStatus}
                </Text>
              </View>
            </View>
          ))}
          {finance.totalDebt > 0 && (
            <TouchableOpacity testID="pay-all-btn" style={[s.payBtn, hasHighEvent && { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }]} onPress={() => router.push('/payments' as any)}>
              <Text style={s.payBtnT}>Оплатити {fmt(finance.totalDebt)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* COMPETITIONS */}
      {competitions.length > 0 && (
        <View style={s.section}>
          <Text style={s.label}>ЗМАГАННЯ</Text>
          {competitions.map((c: any) => (
            <TouchableOpacity key={c.id} style={s.compCard} onPress={() => router.push(`/competitions/${c.id}` as any)}>
              <View style={s.compIcon}><Ionicons name="trophy" size={20} color="#D97706" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.compTitle}>{c.title}</Text>
                <Text style={s.compMeta}>{fmtDate(c.date)} • {c.location}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* RECOMMENDATIONS */}
      {recs.length > 0 && (
        <View style={s.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={s.label}>РЕКОМЕНДОВАНО</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/shop')}><Text style={{ fontSize: 13, fontWeight: '600', color: '#E30613' }}>Усе</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {recs.map((r: any) => (
              <TouchableOpacity key={r.id} style={s.recCard} onPress={() => router.push(`/marketplace/product/${r.id}` as any)}>
                <View style={s.recIconWrap}><Ionicons name="bag-handle" size={24} color="#E30613" /></View>
                <Text style={s.recName} numberOfLines={2}>{r.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Text style={s.recPrice}>{fmt(r.price)}</Text>
                  {r.oldPrice ? <Text style={s.recOld}>{fmt(r.oldPrice)}</Text> : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  scroll: { flex: 1, backgroundColor: '#F8F8F8' },
  scrollContent: { paddingBottom: 32 },
  greeting: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  greetText: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  greetSub: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  // Notification badge
  notifBadge: { position: 'relative', padding: 8 },
  notifDot: { position: 'absolute', top: 4, right: 4, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notifDotT: { fontSize: 10, fontWeight: '800', color: '#fff' },
  section: { paddingHorizontal: 20, marginTop: 20 },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 10 },
  // Event banners
  eventBanner: { borderRadius: 16, padding: 14, borderWidth: 1.5, marginBottom: 10 },
  eventBannerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  eventPriorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  eventMsg: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  eventCtaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  eventCtaText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // Pulse dot for urgent CTAs
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', opacity: 0.7 },
  // Interactive alerts
  alertCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 12, borderWidth: 1, marginBottom: 8, gap: 8 },
  alertText: { fontSize: 13, color: '#78350F', flex: 1 },
  alertBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  alertBtnT: { fontSize: 12, fontWeight: '700', color: '#fff' },
  // Child card
  childCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 10 },
  childTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  childAv: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#E30613', justifyContent: 'center', alignItems: 'center' },
  childAvT: { fontSize: 17, fontWeight: '800', color: '#fff' },
  childName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  childMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeT: { fontSize: 11, fontWeight: '700' },
  childStats: { flexDirection: 'row', marginTop: 14, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  statLbl: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  statDiv: { width: 1, height: 28, backgroundColor: '#E5E7EB' },
  childTraining: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  childTrainT: { fontSize: 13, color: '#374151' },
  // Smart CTA
  smartCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 12 },
  smartCtaT: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Secondary actions
  childActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  childBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  childBtnT: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  // Today
  todayCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  todayRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  todayTime: { backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  todayTimeT: { fontSize: 15, fontWeight: '800', color: '#E30613' },
  todayName: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  todayLoc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Coach
  coachCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 12, marginBottom: 8 },
  coachAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  coachAvT: { fontSize: 17, fontWeight: '800', color: '#fff' },
  coachName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  coachRole: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  coachBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#16A34A' },
  onlineText: { fontSize: 11, color: '#16A34A', fontWeight: '600' },
  // Finance
  finCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  finLbl: { fontSize: 14, color: '#6B7280' },
  finVal: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  finDiv: { height: 1, backgroundColor: '#F3F4F6' },
  payBtn: { backgroundColor: '#E30613', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  payBtnT: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Competitions
  compCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', gap: 12, marginBottom: 8 },
  compIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  compTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  compMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  // Recommendations
  recCard: { width: 150, backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  recIconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  recName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  recPrice: { fontSize: 15, fontWeight: '800', color: '#E30613' },
  recOld: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
});
