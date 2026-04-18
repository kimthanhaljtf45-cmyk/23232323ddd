import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import {
  LimitBlockModal, PastDueModal, UpgradeSuccessModal,
  SmartUpgradeBanners,
} from '@/components/SaasModals';

const PLAN_COLORS: Record<string, string> = {
  START: '#6B7280', PRO: '#2563EB', ENTERPRISE: '#7C3AED',
};
const PLAN_ICONS: Record<string, string> = {
  START: 'rocket-outline', PRO: 'diamond-outline', ENTERPRISE: 'planet-outline',
};
const PLAN_PRICES: Record<string, number> = {
  START: 990, PRO: 2490, ENTERPRISE: 4990,
};

export default function AdminClubScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [triggers, setTriggers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  // Modal states
  const [limitModal, setLimitModal] = useState<any>(null);
  const [pastDueModal, setPastDueModal] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [clubRes, plansRes, triggersRes, invoicesRes, commissionsRes] = await Promise.all([
        api.get('/owner/club').catch((e: any) => { console.log('Club error:', e); return null; }),
        api.get('/platform/plans').catch(() => ({ plans: [] })),
        api.get('/platform/smart-triggers/v2').catch(() => ({ triggers: [], plan: 'START' })),
        api.get('/owner/invoices').catch(() => ({ invoices: [] })),
        api.get('/marketplace/commissions').catch(() => null),
      ]);
      setData(clubRes);
      setPlans(plansRes?.plans || []);
      setTriggers(triggersRes?.triggers || []);
      setInvoices(invoicesRes?.invoices || []);
      setCommissions(commissionsRes);

      // Auto-show PAST_DUE modal
      if (triggersRes?.isBlocked) {
        setPastDueModal(true);
      }
    } catch (e) {
      console.log('Club load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(true);
    try {
      const res = await api.post('/owner/club/upgrade', { plan: planId });
      if (res?.success) {
        setUpgradeSuccess(res);
        setShowPlans(false);
        setLimitModal(null);
        load();
      } else {
        Alert.alert('Помилка', res?.error || 'Не вдалось змінити тариф');
      }
    } catch (e: any) {
      const errData = e?.response?.data;
      if (errData?.upgrade_required) {
        setLimitModal(errData);
      } else {
        Alert.alert('Помилка', errData?.error || 'Не вдалось змінити тариф');
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handlePayInvoice = async () => {
    setPastDueModal(false);
    // Find first unpaid invoice and create WayForPay payment
    const unpaid = invoices.find((inv: any) => inv.status === 'PENDING' || inv.status === 'OVERDUE');
    if (unpaid) {
      try {
        // Create real WayForPay payment
        const res = await api.post('/payments/create', { invoiceId: unpaid.id });
        if (res?.paymentUrl) {
          // Open WayForPay payment page
          const canOpen = await Linking.canOpenURL(res.paymentUrl);
          if (canOpen) {
            await Linking.openURL(res.paymentUrl);
          } else {
            Alert.alert('Оплата', `Перейдіть за посиланням:\n${res.paymentUrl}`);
          }
        } else if (res?.error) {
          Alert.alert('Помилка', res.error);
        }
      } catch (e: any) {
        const errMsg = e?.response?.data?.error || 'Не вдалось створити платіж';
        Alert.alert('Помилка', errMsg);
      }
    } else {
      Alert.alert('Немає рахунків', 'Неоплачених рахунків не знайдено');
    }
  };

  const fmt = (v: number) => `${(v || 0).toLocaleString()} ₴`;

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={s.center}>
        <Text style={s.emptyT}>Немає даних клубу</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryBtnT}>Оновити</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { club, plan, limits, business, team, subscription } = data;
  const planColor = PLAN_COLORS[plan?.id] || '#6B7280';

  // Calculate losses & potential
  const losses = {
    debtLoss: business?.debtTotal || 0,
    churnLoss: Math.round((business?.totalStudents - business?.activeStudents) * (business?.arpu || 0)),
    commissionLoss: Math.round((business?.marketplaceRevenue || 0) * (business?.commissionRate || 0.07)),
  };
  const totalLoss = losses.debtLoss + losses.churnLoss + losses.commissionLoss;

  const potential = {
    ifAllPay: Math.round((business?.totalStudents || 0) * (business?.arpu || 1000)),
    upgradeGain: plan?.id !== 'ENTERPRISE' ? Math.round((business?.activeStudents || 0) * 0.15 * (business?.arpu || 1000)) : 0,
    marketplaceGain: Math.round((business?.marketplaceRevenue || 0) * 0.3),
  };
  const totalPotential = potential.ifAllPay + potential.upgradeGain + potential.marketplaceGain;

  const pendingInvoices = invoices.filter((inv: any) => inv.status === 'PENDING' || inv.status === 'OVERDUE');

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor="#7C3AED"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="club-back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Клуб</Text>
          <Text style={s.subtitle}>{club?.name || 'АТАКА'}</Text>
        </View>
        <View style={[s.planBadge, { backgroundColor: planColor }]}>
          <Text style={s.planBadgeT}>{plan?.name || 'Start'}</Text>
        </View>
      </View>

      {/* ── SMART UPGRADE BANNERS (3-level) ── */}
      {triggers.length > 0 && (
        <View style={s.section}>
          <SmartUpgradeBanners
            triggers={triggers}
            onUpgrade={handleUpgrade}
            onPayInvoice={() => setPastDueModal(true)}
          />
        </View>
      )}

      {/* ── БІЗНЕС (owner priority) ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>💰 БІЗНЕС</Text>
        <View style={s.bizGrid}>
          <View style={[s.bizCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.bizVal, { color: '#16A34A' }]}>{fmt(business?.revenue)}</Text>
            <Text style={s.bizLbl}>Виручка (міс)</Text>
          </View>
          <View style={[s.bizCard, { backgroundColor: business?.debtTotal > 0 ? '#FEF2F2' : '#F0FDF4' }]}>
            <Text style={[s.bizVal, { color: business?.debtTotal > 0 ? '#DC2626' : '#16A34A' }]}>{fmt(business?.debtTotal)}</Text>
            <Text style={s.bizLbl}>Борги</Text>
          </View>
          <View style={[s.bizCard, { backgroundColor: '#EFF6FF' }]}>
            <Text style={[s.bizVal, { color: '#2563EB' }]}>{business?.retention || 0}%</Text>
            <Text style={s.bizLbl}>Retention</Text>
          </View>
          <View style={[s.bizCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[s.bizVal, { color: '#D97706' }]}>{fmt(business?.marketplaceRevenue)}</Text>
            <Text style={s.bizLbl}>Маркетплейс</Text>
          </View>
        </View>
        <View style={s.bizSummary}>
          <View style={s.bizRow}><Text style={s.bizRowL}>LTV (на учня)</Text><Text style={[s.bizRowV, { color: '#7C3AED' }]}>{fmt(business?.ltv)}</Text></View>
          <View style={s.bizRow}><Text style={s.bizRowL}>ARPU (міс)</Text><Text style={s.bizRowV}>{fmt(business?.arpu)}</Text></View>
          <View style={s.bizRow}><Text style={s.bizRowL}>Учнів (активних)</Text><Text style={s.bizRowV}>{business?.activeStudents || 0} / {business?.totalStudents || 0}</Text></View>
          <View style={s.bizRow}><Text style={s.bizRowL}>Комісія маркетплейсу</Text><Text style={s.bizRowV}>{((business?.commissionRate || 0) * 100).toFixed(0)}%</Text></View>
          <View style={s.bizRow}><Text style={s.bizRowL}>Плата за платформу</Text><Text style={[s.bizRowV, { color: '#DC2626' }]}>-{fmt(business?.platformFee)}/міс</Text></View>
        </View>
      </View>

      {/* ── ВТРАТИ ТА ПОТЕНЦІАЛ ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>📉 ВТРАТИ ТА ПОТЕНЦІАЛ</Text>
        <View style={s.lossCard}>
          <Text style={s.lossTitle}>Щомісячні втрати</Text>
          <Text style={s.lossTotalVal}>-{fmt(totalLoss)}</Text>
          <View style={s.lossRow}>
            <Ionicons name="card" size={14} color="#DC2626" />
            <Text style={s.lossRowL}>Борги учнів</Text>
            <Text style={s.lossRowV}>-{fmt(losses.debtLoss)}</Text>
          </View>
          <View style={s.lossRow}>
            <Ionicons name="people" size={14} color="#F59E0B" />
            <Text style={s.lossRowL}>Відтік учнів</Text>
            <Text style={s.lossRowV}>-{fmt(losses.churnLoss)}</Text>
          </View>
          <View style={s.lossRow}>
            <Ionicons name="storefront" size={14} color="#7C3AED" />
            <Text style={s.lossRowL}>Комісія платформи</Text>
            <Text style={s.lossRowV}>-{fmt(losses.commissionLoss)}</Text>
          </View>
        </View>

        <View style={s.potentialCard}>
          <Text style={s.potentialTitle}>Потенціал зростання</Text>
          <Text style={s.potentialTotalVal}>+{fmt(totalPotential)}</Text>
          <View style={s.lossRow}>
            <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
            <Text style={s.lossRowL}>Якщо всі сплатять</Text>
            <Text style={[s.lossRowV, { color: '#16A34A' }]}>+{fmt(potential.ifAllPay)}</Text>
          </View>
          {potential.upgradeGain > 0 && (
            <View style={s.lossRow}>
              <Ionicons name="trending-up" size={14} color="#2563EB" />
              <Text style={s.lossRowL}>Ріст після апгрейду</Text>
              <Text style={[s.lossRowV, { color: '#2563EB' }]}>+{fmt(potential.upgradeGain)}</Text>
            </View>
          )}
          <View style={s.lossRow}>
            <Ionicons name="cart" size={14} color="#7C3AED" />
            <Text style={s.lossRowL}>Маркетплейс потенціал</Text>
            <Text style={[s.lossRowV, { color: '#7C3AED' }]}>+{fmt(potential.marketplaceGain)}</Text>
          </View>
        </View>
      </View>

      {/* ── КОМІСІЇ МАРКЕТПЛЕЙСУ ── */}
      {commissions && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>🏪 КОМІСІЇ МАРКЕТПЛЕЙСУ</Text>
          <View style={s.commissionCard}>
            <View style={s.commRow}>
              <View style={s.commBlock}>
                <Text style={s.commVal}>{fmt(commissions.monthCommission || 0)}</Text>
                <Text style={s.commLbl}>Комісія (міс)</Text>
              </View>
              <View style={s.commBlock}>
                <Text style={s.commVal}>{commissions.monthOrders || 0}</Text>
                <Text style={s.commLbl}>Замовлень</Text>
              </View>
              <View style={s.commBlock}>
                <Text style={s.commVal}>{((business?.commissionRate || 0) * 100).toFixed(0)}%</Text>
                <Text style={s.commLbl}>Ставка</Text>
              </View>
            </View>
            {plan?.id !== 'ENTERPRISE' && (
              <View style={s.commHint}>
                <Ionicons name="information-circle" size={14} color="#7C3AED" />
                <Text style={s.commHintT}>
                  При тарифі ENTERPRISE комісія знижується до 5%
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── ТАРИФ / ЛІМІТИ ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>📊 ТАРИФ І ЛІМІТИ</Text>
        <View style={[s.planCard, { borderColor: planColor + '40' }]}>
          <View style={s.planTop}>
            <View style={[s.planIcon, { backgroundColor: planColor + '15' }]}>
              <Ionicons name={(PLAN_ICONS[plan?.id] || 'rocket-outline') as any} size={28} color={planColor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.planName, { color: planColor }]}>{plan?.name || 'Start'}</Text>
              <Text style={s.planPrice}>{fmt(plan?.price || 990)} / міс</Text>
            </View>
            {subscription && (
              <View style={[s.statusBadge, {
                backgroundColor: subscription.status === 'ACTIVE' ? '#DCFCE7' :
                  subscription.status === 'PAST_DUE' ? '#FEE2E2' : '#FEF3C7'
              }]}>
                <Text style={[s.statusBadgeT, {
                  color: subscription.status === 'ACTIVE' ? '#16A34A' :
                    subscription.status === 'PAST_DUE' ? '#DC2626' : '#D97706'
                }]}>
                  {subscription.status === 'ACTIVE' ? '✓ Активна' :
                    subscription.status === 'PAST_DUE' ? '! Прострочена' : subscription.status}
                </Text>
              </View>
            )}
          </View>

          {/* Limits with 3-level coloring */}
          {['students', 'coaches', 'branches'].map(key => {
            const l = limits?.[key] || { current: 0, limit: 0, percent: 0 };
            const pct = Math.min(l.percent, 100);
            const label = key === 'students' ? 'Учні' : key === 'coaches' ? 'Тренери' : 'Філіали';

            let barColor = planColor;
            let warnText = '';
            if (pct >= 100) {
              barColor = '#DC2626';
              warnText = '🔴 Ліміт вичерпано!';
            } else if (pct >= 90) {
              barColor = '#EF4444';
              warnText = '🟠 Критичний рівень';
            } else if (pct >= 75) {
              barColor = '#F59E0B';
              warnText = '🟡 Наближається ліміт';
            }

            return (
              <View key={key} style={s.limitRow}>
                <View style={s.limitHeader}>
                  <Text style={s.limitLabel}>{label}</Text>
                  <Text style={[s.limitVal, pct >= 90 && { color: '#DC2626', fontWeight: '700' }]}>
                    {l.current} / {l.limit}
                  </Text>
                </View>
                <View style={s.limitBar}>
                  <View style={[s.limitBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
                </View>
                {warnText ? (
                  <Text style={[s.limitWarn, { color: barColor }]}>{warnText} ({pct}%)</Text>
                ) : null}
              </View>
            );
          })}

          {/* Features */}
          <View style={s.featuresRow}>
            {Object.entries(plan?.features || {}).filter(([, v]) => v).map(([k]) => (
              <View key={k} style={s.featureTag}>
                <Ionicons name="checkmark-circle" size={12} color="#16A34A" />
                <Text style={s.featureTagT}>{k}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            testID="upgrade-plan-btn"
            style={[s.upgradeBtn, { backgroundColor: planColor }]}
            onPress={() => setShowPlans(!showPlans)}
          >
            <Ionicons name="arrow-up-circle" size={18} color="#fff" />
            <Text style={s.upgradeBtnT}>{showPlans ? 'Сховати тарифи' : 'Змінити тариф'}</Text>
          </TouchableOpacity>
        </View>

        {/* Plans comparison with one-click upgrade */}
        {showPlans && plans.length > 0 && (
          <View style={s.plansGrid}>
            {plans.map(p => {
              const isActive = p.id === plan?.id;
              const isLower = (PLAN_PRICES[p.id] || 0) <= (PLAN_PRICES[plan?.id] || 0);
              const color = PLAN_COLORS[p.id] || '#6B7280';
              const discountPrice = Math.round((p.price || 0) * 0.7); // 30% discount

              return (
                <View
                  key={p.id}
                  testID={`plan-card-${p.id}`}
                  style={[s.planOptionCard, isActive && { borderColor: color, borderWidth: 2 }]}
                >
                  <View style={s.planOptionHeader}>
                    <View>
                      <Text style={[s.planOptionName, { color }]}>{p.name}</Text>
                      <Text style={s.planOptionLimits}>
                        {p.limits?.students === 9999 ? '∞' : p.limits?.students} учнів • {p.limits?.coaches === 9999 ? '∞' : p.limits?.coaches} тренерів • {p.limits?.branches === 9999 ? '∞' : p.limits?.branches} філ.
                      </Text>
                    </View>
                    {!isActive && !isLower && (
                      <View style={[s.discountTag, { backgroundColor: '#DC262610' }]}>
                        <Text style={[s.discountTagT, { color: '#DC2626' }]}>-30%</Text>
                      </View>
                    )}
                  </View>

                  {/* Price section */}
                  <View style={s.planOptionPriceRow}>
                    {!isActive && !isLower ? (
                      <>
                        <Text style={s.planOptionOldPrice}>{p.price} ₴</Text>
                        <Text style={[s.planOptionPrice, { color }]}>{discountPrice} ₴/міс</Text>
                      </>
                    ) : (
                      <Text style={[s.planOptionPrice, { color }]}>{fmt(p.price)}/міс</Text>
                    )}
                  </View>

                  {/* Commission info */}
                  <Text style={s.planOptionCommission}>
                    Комісія маркетплейсу: {((p.commission?.marketplace || 0) * 100).toFixed(0)}%
                  </Text>

                  {isActive ? (
                    <View style={[s.planActiveTag, { backgroundColor: color + '15' }]}>
                      <Ionicons name="checkmark-circle" size={16} color={color} />
                      <Text style={[s.planActiveTagT, { color }]}>Поточний тариф</Text>
                    </View>
                  ) : isLower ? (
                    <View style={[s.planActiveTag, { backgroundColor: '#F3F4F6' }]}>
                      <Text style={[s.planActiveTagT, { color: '#9CA3AF' }]}>Нижчий тариф</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.planSelectBtn, { backgroundColor: color }]}
                      onPress={() => handleUpgrade(p.id)}
                      disabled={upgrading}
                      activeOpacity={0.8}
                    >
                      {upgrading ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <Ionicons name="flash" size={16} color="#fff" />
                          <Text style={s.planSelectBtnT}>Оновити зараз • {discountPrice} ₴</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── РАХУНКИ ── */}
      {pendingInvoices.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionLabel}>📄 НЕОПЛАЧЕНІ РАХУНКИ</Text>
          {pendingInvoices.map((inv: any) => (
            <View key={inv.id} style={s.invoiceCard}>
              <View style={s.invoiceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.invoiceDesc}>{inv.description || `${inv.type} — ${inv.plan}`}</Text>
                  <Text style={s.invoiceDate}>
                    Термін: {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('uk-UA') : '-'}
                  </Text>
                </View>
                <View>
                  <Text style={s.invoiceAmount}>{fmt(inv.amount)}</Text>
                  {inv.discountPercent > 0 && (
                    <Text style={s.invoiceDiscount}>-{inv.discountPercent}% знижка</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[s.payBtn, inv.status === 'OVERDUE' && { backgroundColor: '#DC2626' }]}
                onPress={async () => {
                  try {
                    const res = await api.post('/payments/create', { invoiceId: inv.id });
                    if (res?.paymentUrl) {
                      const canOpen = await Linking.canOpenURL(res.paymentUrl);
                      if (canOpen) {
                        await Linking.openURL(res.paymentUrl);
                      } else {
                        Alert.alert('Оплата', `Перейдіть за посиланням:\n${res.paymentUrl}`);
                      }
                    } else {
                      Alert.alert('Помилка', res?.error || 'Не вдалось створити платіж');
                    }
                  } catch (e: any) {
                    Alert.alert('Помилка', e?.response?.data?.error || 'Не вдалось створити платіж');
                  }
                }}
              >
                <Ionicons name="card" size={14} color="#fff" />
                <Text style={s.payBtnT}>
                  {inv.status === 'OVERDUE' ? 'Оплатити терміново' : 'Оплатити'}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── КОМАНДА ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>👥 КОМАНДА</Text>
        {(team || []).map((m: any, i: number) => {
          const roleColor = m.role === 'OWNER' ? '#7C3AED' : m.role === 'ADMIN' ? '#2563EB' : m.role === 'COACH' ? '#16A34A' : '#6B7280';
          const roleLabel = m.role === 'OWNER' ? 'Власник' : m.role === 'ADMIN' ? 'Адмін' : m.role === 'COACH' ? 'Тренер' : m.role;
          return (
            <View key={i} style={s.teamCard}>
              <View style={[s.teamAv, { backgroundColor: roleColor + '15' }]}>
                <Text style={[s.teamAvT, { color: roleColor }]}>{m.name?.charAt(0) || '?'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.teamName}>{m.name}</Text>
                <Text style={s.teamPhone}>{m.phone}</Text>
              </View>
              <View style={[s.roleBadge, { backgroundColor: roleColor + '15' }]}>
                <Text style={[s.roleBadgeT, { color: roleColor }]}>{roleLabel}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* ── ОСНОВНЕ (club info) ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>🏢 ОСНОВНЕ</Text>
        <View style={s.infoCard}>
          <View style={s.infoRow}><Text style={s.infoLbl}>Назва</Text><Text style={s.infoVal}>{club?.name}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLbl}>Місто</Text><Text style={s.infoVal}>{club?.city}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLbl}>Телефон</Text><Text style={s.infoVal}>{club?.phone}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLbl}>Email</Text><Text style={s.infoVal}>{club?.email}</Text></View>
          <View style={s.infoRow}><Text style={s.infoLbl}>Статус</Text><Text style={[s.infoVal, { color: '#16A34A' }]}>{club?.status}</Text></View>
        </View>
      </View>

      {/* ── ШВИДКІ ДІЇ ── */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>⚡ ШВИДКІ ДІЇ</Text>
        {[
          { label: 'Управління тарифами', icon: 'pricetags', screen: '/admin/pricing' },
          { label: 'Event Engine', icon: 'pulse', screen: '/admin/events' },
          { label: 'Автоматизація', icon: 'flash', screen: '/admin/automation' },
          { label: 'Фінанси', icon: 'card', screen: '/admin/finance' },
          { label: 'Маркетплейс', icon: 'storefront', screen: '/admin/marketplace' },
        ].map((item, i) => (
          <TouchableOpacity key={i} testID={`quick-action-${i}`} style={s.quickAction} onPress={() => router.push(item.screen as any)}>
            <Ionicons name={item.icon as any} size={20} color="#374151" />
            <Text style={s.quickActionT}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />

      {/* ── MODALS ── */}
      <LimitBlockModal
        visible={!!limitModal}
        onClose={() => setLimitModal(null)}
        onUpgrade={handleUpgrade}
        resource={limitModal?.resource}
        current={limitModal?.current}
        limit={limitModal?.limit}
        percent={limitModal?.percent}
        currentPlan={limitModal?.currentPlan}
        upgradeTo={limitModal?.upgradeTo}
        upgradeDiscount={limitModal?.upgradeDiscount || 30}
        message={limitModal?.message}
      />

      <PastDueModal
        visible={pastDueModal}
        onClose={() => setPastDueModal(false)}
        onPayInvoice={handlePayInvoice}
        overdueCount={triggers.filter((t: any) => t.type === 'past_due').length || 1}
        plan={plan?.id}
      />

      <UpgradeSuccessModal
        visible={!!upgradeSuccess}
        onClose={() => setUpgradeSuccess(null)}
        plan={upgradeSuccess?.plan}
        fromPlan={upgradeSuccess?.fromPlan}
        finalPrice={upgradeSuccess?.finalPrice}
        basePrice={upgradeSuccess?.basePrice}
        discountPercent={upgradeSuccess?.discountPercent}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8' },
  emptyT: { fontSize: 16, color: '#6B7280' },
  retryBtn: { marginTop: 12, backgroundColor: '#7C3AED', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  retryBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1, backgroundColor: '#F8F8F8' },
  scrollContent: { paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 8 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#6B7280' },
  planBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  planBadgeT: { fontSize: 13, fontWeight: '700', color: '#fff' },
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1, marginBottom: 10 },
  // Business
  bizGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bizCard: { width: '47%' as any, borderRadius: 16, padding: 16, minWidth: 140 },
  bizVal: { fontSize: 22, fontWeight: '800' },
  bizLbl: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  bizSummary: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginTop: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  bizRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  bizRowL: { fontSize: 14, color: '#6B7280' },
  bizRowV: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  // Losses & Potential
  lossCard: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FECACA', marginBottom: 10 },
  lossTitle: { fontSize: 14, fontWeight: '700', color: '#991B1B', marginBottom: 4 },
  lossTotalVal: { fontSize: 24, fontWeight: '800', color: '#DC2626', marginBottom: 12 },
  lossRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  lossRowL: { flex: 1, fontSize: 13, color: '#6B7280' },
  lossRowV: { fontSize: 13, fontWeight: '600', color: '#DC2626' },
  potentialCard: { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' },
  potentialTitle: { fontSize: 14, fontWeight: '700', color: '#166534', marginBottom: 4 },
  potentialTotalVal: { fontSize: 24, fontWeight: '800', color: '#16A34A', marginBottom: 12 },
  // Commissions
  commissionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  commRow: { flexDirection: 'row', gap: 10 },
  commBlock: { flex: 1, alignItems: 'center' },
  commVal: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  commLbl: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  commHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  commHintT: { fontSize: 12, color: '#7C3AED', flex: 1 },
  // Plan
  planCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  planIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  planName: { fontSize: 20, fontWeight: '800' },
  planPrice: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusBadgeT: { fontSize: 11, fontWeight: '700' },
  limitRow: { marginTop: 14 },
  limitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  limitLabel: { fontSize: 13, color: '#6B7280' },
  limitVal: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  limitBar: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 4 },
  limitBarFill: { height: 8, borderRadius: 4 },
  limitWarn: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  featuresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  featureTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  featureTagT: { fontSize: 10, fontWeight: '600', color: '#16A34A', textTransform: 'capitalize' },
  upgradeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginTop: 16 },
  upgradeBtnT: { fontSize: 16, fontWeight: '700', color: '#fff' },
  // Plans grid
  plansGrid: { marginTop: 12, gap: 12 },
  planOptionCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  planOptionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  planOptionName: { fontSize: 18, fontWeight: '800' },
  planOptionLimits: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  planOptionPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  planOptionOldPrice: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through' },
  planOptionPrice: { fontSize: 20, fontWeight: '800' },
  planOptionCommission: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  discountTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  discountTagT: { fontSize: 12, fontWeight: '800' },
  planActiveTag: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingVertical: 10, borderRadius: 10 },
  planActiveTagT: { fontSize: 14, fontWeight: '600' },
  planSelectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, paddingVertical: 12, borderRadius: 12 },
  planSelectBtnT: { fontSize: 14, fontWeight: '700', color: '#fff' },
  // Invoices
  invoiceCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  invoiceDesc: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  invoiceDate: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  invoiceAmount: { fontSize: 16, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  invoiceDiscount: { fontSize: 10, color: '#DC2626', fontWeight: '600', textAlign: 'right' },
  payBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7C3AED', paddingVertical: 10, borderRadius: 10, marginTop: 10 },
  payBtnT: { fontSize: 13, fontWeight: '700', color: '#fff' },
  // Team
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  teamAv: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  teamAvT: { fontSize: 16, fontWeight: '800' },
  teamName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  teamPhone: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeT: { fontSize: 11, fontWeight: '700' },
  // Info
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLbl: { fontSize: 13, color: '#6B7280' },
  infoVal: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  // Quick actions
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8 },
  quickActionT: { flex: 1, fontSize: 15, fontWeight: '600', color: '#0F172A' },
});
