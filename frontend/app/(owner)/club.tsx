import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

const SAAS_PLANS = [
  { id: 'START', name: 'START', price: 990, priceLabel: '990 ₴/міс', students: 50, coaches: 3, branches: 1, commission: '10%', color: '#6B7280', features: ['Dashboard', 'Відвідуваність', 'Оплати', 'Повідомлення'] },
  { id: 'PRO', name: 'PRO', price: 2490, priceLabel: '2 490 ₴/міс', students: 200, coaches: 10, branches: 5, commission: '7%', color: '#3B82F6', features: ['Всі START +', 'Маркетплейс', 'Змагання', 'Автоматизація', 'AI рекомендації'] },
  { id: 'ENTERPRISE', name: 'ENTERPRISE', price: 4990, priceLabel: '4 990 ₴/міс', students: '∞', coaches: '∞', branches: '∞', commission: '5%', color: '#7C3AED', features: ['Всі PRO +', 'Без лімітів', 'Пріоритетна підтримка', 'Кастом інтеграції', 'Франшизний дашборд'] },
];

const DURATION_OPTIONS = [
  { label: 'Разове', days: 1, sessions: 1 },
  { label: '8 тренувань', days: 30, sessions: 8 },
  { label: '12 тренувань', days: 30, sessions: 12 },
  { label: 'Місяць (безліміт)', days: 30, sessions: 999 },
  { label: '3 місяці', days: 90, sessions: 999 },
  { label: '6 місяців', days: 180, sessions: 999 },
  { label: 'Рік', days: 365, sessions: 999 },
];

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PENDING_REVIEW: { label: 'На розгляді', color: '#F59E0B', bg: '#FFFBEB' },
  PENDING: { label: 'Очікує', color: '#F59E0B', bg: '#FFFBEB' },
  APPROVED: { label: 'Схвалено', color: '#10B981', bg: '#F0FDF4' },
  ACTIVE: { label: 'Активний', color: '#10B981', bg: '#F0FDF4' },
  REJECTED: { label: 'Відхилено', color: '#EF4444', bg: '#FEF2F2' },
};

export default function OwnerClub() {
  const [club, setClub] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedClub, setSelectedClub] = useState<any>(null);
  const [clubPlans, setClubPlans] = useState<any[]>([]);
  const [commissionPct, setCommissionPct] = useState(10);
  const [upgradeStatus, setUpgradeStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateBranch, setShowCreateBranch] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [branchName, setBranchName] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchAddr, setBranchAddr] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planDuration, setPlanDuration] = useState(DURATION_OPTIONS[1]);
  const [planFreezeDays, setPlanFreezeDays] = useState('0');
  const [planDiscount, setPlanDiscount] = useState('0');
  const [creating, setCreating] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  const fetchData = async () => {
    try {
      const [clubRes, branchRes, upgradeRes] = await Promise.allSettled([
        api.get('/owner/club'),
        api.get('/owner/branches'),
        api.get('/owner/upgrade-status'),
      ]);
      if (clubRes.status === 'fulfilled') {
        const raw = clubRes.value.data || clubRes.value;
        // raw = {club: {...}, plan: {id,name,price,...}, stats: {...}, limits: {...}, ...}
        setClub(raw);
      }
      const b = (branchRes.status === 'fulfilled') ? ((branchRes.value.data || branchRes.value)?.branches || []) : [];
      setBranches(b);
      if (upgradeRes.status === 'fulfilled') setUpgradeStatus((upgradeRes.value.data || upgradeRes.value)?.pending);
      const clubData = (clubRes.status === 'fulfilled') ? (clubRes.value.data || clubRes.value) : null;
      const firstId = clubData?.club?.id || clubData?.club?._id || (b[0]?.id);
      if (firstId) { setSelectedClub(firstId); loadPlans(firstId); } else { loadPlans(''); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const loadPlans = async (clubId: string) => {
    try {
      const res = await api.get(`/owner/club-plans?clubId=${clubId}`);
      setClubPlans(res.data?.plans || []);
      setCommissionPct(res.data?.commissionPercent || 10);
    } catch { }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  // Extract plan ID as string (API returns plan as object {id, name, price, ...})
  const clubData = club?.club || club || {};
  const planObj = club?.plan;
  const currentPlan = typeof planObj === 'string' ? planObj : (planObj?.id || clubData?.plan || 'START');
  const planConfig = SAAS_PLANS.find(p => p.id === currentPlan) || SAAS_PLANS[0];
  const activeBranches = branches.filter(b => b.reviewStatus !== 'REJECTED');

  const handleCreateBranch = async () => {
    if (!branchName.trim()) return;
    const branchLimit = typeof planConfig.branches === 'number' ? planConfig.branches : 999;
    if (activeBranches.length >= branchLimit) {
      Alert.alert('Ліміт філіалів', `Тариф ${currentPlan} дозволяє ${branchLimit} філіалів`, [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Підвищити тариф', onPress: () => { setShowCreateBranch(false); setShowUpgrade(true); } },
      ]);
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/owner/clubs/create', { name: branchName, city: branchCity, address: branchAddr });
      Alert.alert('Заявку надіслано!', res.data?.message || 'Філіал на ревью');
      setShowCreateBranch(false); setBranchName(''); setBranchCity(''); setBranchAddr('');
      fetchData();
    } catch (e: any) { Alert.alert('Помилка', e?.response?.data?.error || 'Не вдалось створити'); }
    finally { setCreating(false); }
  };

  const handleAddPlan = async () => {
    if (!planName.trim() || !planPrice) return;
    try {
      await api.post('/owner/club-plans', {
        name: planName, price: Number(planPrice),
        sessions: planDuration.sessions, durationDays: planDuration.days,
        freezeDays: Number(planFreezeDays) || 0, discountPercent: Number(planDiscount) || 0,
        clubId: selectedClub || '',
      });
      Alert.alert('Успіх', 'Абонемент додано');
      setShowAddPlan(false); setPlanName(''); setPlanPrice(''); setPlanFreezeDays('0'); setPlanDiscount('0');
      loadPlans(selectedClub || '');
    } catch (e: any) { Alert.alert('Помилка', e?.response?.data?.error || 'Не вдалось додати'); }
  };

  const handleDeletePlan = (planId: string) => {
    Alert.alert('Видалити абонемент?', '', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: async () => {
        try { await api.delete(`/owner/club-plans/${planId}`); loadPlans(selectedClub || ''); } catch { Alert.alert('Помилка'); }
      }},
    ]);
  };

  const handleUpgradeRequest = async (planId: string) => {
    if (planId === currentPlan) return;
    setUpgrading(true);
    try {
      const res = await api.post('/owner/club/upgrade', { plan: planId });
      Alert.alert('Заявку надіслано!', res.data?.message || `Запит на ${planId} на розгляді`);
      setShowUpgrade(false);
      fetchData();
    } catch (e: any) {
      Alert.alert('Помилка', e?.response?.data?.error || 'Не вдалось надіслати заявку');
    } finally { setUpgrading(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <ScrollView style={s.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}>

        {/* ═══════ FRANCHISE / SaaS TARIFF ═══════ */}
        <View style={s.franchiseSection}>
          <View style={s.franchiseHeader}>
            <Ionicons name="diamond" size={20} color="#7C3AED" />
            <Text style={s.franchiseTitle}>Тариф франшизи (SaaS)</Text>
          </View>
          <View style={s.currentPlanCard} testID="current-franchise-plan">
            <View style={s.currentPlanRow}>
              <View style={[s.planBadgeLg, { backgroundColor: planConfig.color }]}>
                <Text style={s.planBadgeLgText}>{String(currentPlan)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.currentPlanPrice}>{planConfig.priceLabel}</Text>
                <Text style={s.currentPlanDetails}>Учнів: {String(planConfig.students)} · Тренерів: {String(planConfig.coaches)} · Комісія: {planConfig.commission}</Text>
              </View>
            </View>
            {upgradeStatus && (
              <View style={s.pendingRequestBanner} testID="pending-upgrade-request">
                <Ionicons name="time-outline" size={16} color="#F59E0B" />
                <Text style={s.pendingRequestText}>Заявка на {upgradeStatus.requestedPlan} — на розгляді у адміністратора</Text>
              </View>
            )}
          </View>
          <TouchableOpacity testID="change-franchise-plan-btn" style={s.franchiseBtn} onPress={() => setShowUpgrade(true)} disabled={!!upgradeStatus}>
            <Ionicons name="rocket-outline" size={20} color={upgradeStatus ? '#9CA3AF' : '#7C3AED'} />
            <Text style={[s.franchiseBtnText, upgradeStatus && { color: '#9CA3AF' }]}>{upgradeStatus ? 'Заявка на розгляді' : 'Змінити тариф франшизи'}</Text>
          </TouchableOpacity>
        </View>

        {/* ═══════ BRANCHES ═══════ */}
        <Text style={s.sectionTitle}>Філіали ({branches.length})</Text>
        {branches.map((b, i) => {
          const st = STATUS_MAP[b.reviewStatus] || STATUS_MAP[b.status] || STATUS_MAP.ACTIVE;
          return (
            <TouchableOpacity key={i} style={[s.branchCard, selectedClub === b.id && s.branchCardSelected]} testID={`branch-${b.id}`} onPress={() => { setSelectedClub(b.id); loadPlans(b.id); }}>
              <View style={s.branchHeader}>
                <Ionicons name="business" size={20} color="#1F2937" />
                <Text style={s.branchName}>{b.name}</Text>
                <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[s.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <Text style={s.branchCity}>{b.city || ''} {b.address ? `· ${b.address}` : ''}</Text>
              {selectedClub === b.id && <Text style={s.branchSelected}>Обрано ✓</Text>}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity testID="create-branch-btn" style={s.actionBtn} onPress={() => setShowCreateBranch(true)}>
          <Ionicons name="add-circle" size={22} color="#FFF" />
          <Text style={s.actionBtnText}>Створити філіал</Text>
        </TouchableOpacity>

        {/* ═══════ CLUB INTERNAL TARIFFS (АБОНЕМЕНТИ) ═══════ */}
        <View style={s.sectionHeader}>
          <View>
            <Text style={s.sectionTitle}>Абонементи клубу</Text>
            <Text style={s.sectionSub}>Внутрішні тарифи для учнів</Text>
          </View>
          <TouchableOpacity testID="add-club-plan-btn" onPress={() => setShowAddPlan(true)} style={s.addPlanBtn}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={s.addPlanBtnText}>Додати</Text>
          </TouchableOpacity>
        </View>
        {selectedClub && <Text style={s.planClubLabel}>Для: {branches.find(b => b.id === selectedClub)?.name || 'клуб'} · Комісія платформи: {commissionPct}%</Text>}

        {clubPlans.length === 0 ? (
          <View style={s.emptyCard}>
            <Ionicons name="document-text-outline" size={36} color="#D1D5DB" />
            <Text style={s.emptyText}>Немає абонементів</Text>
            <Text style={s.emptyHint}>Створіть тарифи для вашого клубу</Text>
          </View>
        ) : clubPlans.map((p, i) => {
          const commission = Math.round(p.price * commissionPct / 100);
          const net = p.price - commission;
          const durationLabel = p.durationDays >= 365 ? 'Рік' : p.durationDays >= 180 ? '6 міс' : p.durationDays >= 90 ? '3 міс' : p.durationDays >= 28 ? 'Місяць' : `${p.durationDays || 30} днів`;
          const sessionsLabel = p.sessions >= 999 ? 'Безліміт' : `${p.sessions} тренувань`;
          return (
            <View key={i} style={s.clubPlanCard} testID={`club-plan-${p.id || i}`}>
              <View style={s.clubPlanHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.clubPlanName}>{p.name}</Text>
                  <Text style={s.clubPlanMeta}>{sessionsLabel} · {durationLabel}{p.freezeDays > 0 ? ` · 🧊 ${p.freezeDays} днів заморозки` : ''}{p.discountPercent > 0 ? ` · 💰 -{p.discountPercent}%` : ''}</Text>
                </View>
                <TouchableOpacity testID={`delete-plan-${p.id || i}`} onPress={() => handleDeletePlan(p.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={s.clubPlanRow}>
                <View style={s.clubPlanItem}><Text style={s.cpLabel}>Ціна</Text><Text style={s.cpValue}>{p.price} ₴</Text></View>
                <View style={s.clubPlanItem}><Text style={s.cpLabel}>Комісія</Text><Text style={[s.cpValue, { color: '#EF4444' }]}>-{commission} ₴</Text></View>
                <View style={s.clubPlanItem}><Text style={s.cpLabel}>Ваш дохід</Text><Text style={[s.cpValue, { color: '#10B981' }]}>{net} ₴</Text></View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ═══════ Create Branch Modal ═══════ */}
      <Modal visible={showCreateBranch} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Новий філіал</Text>
              <TouchableOpacity onPress={() => setShowCreateBranch(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
            </View>
            <View style={s.infoBox}>
              <Ionicons name="information-circle" size={18} color="#3B82F6" />
              <Text style={s.infoBoxText}>Після створення філіал буде надіслано на ревью адміністратору</Text>
            </View>
            <Text style={s.inputLabel}>Назва клубу</Text>
            <TextInput style={s.input} value={branchName} onChangeText={setBranchName} placeholder="АТАКА Львів" testID="branch-name-input" />
            <Text style={s.inputLabel}>Місто</Text>
            <TextInput style={s.input} value={branchCity} onChangeText={setBranchCity} placeholder="Львів" testID="branch-city-input" />
            <Text style={s.inputLabel}>Адреса (опціонально)</Text>
            <TextInput style={s.input} value={branchAddr} onChangeText={setBranchAddr} placeholder="вул. Шевченка, 25" testID="branch-addr-input" />
            <TouchableOpacity testID="confirm-create-branch" style={s.confirmBtn} onPress={handleCreateBranch} disabled={creating}>
              {creating ? <ActivityIndicator color="#FFF" /> : <Text style={s.confirmBtnText}>Надіслати на ревью</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════ Add Club Plan / Абонемент Modal ═══════ */}
      <Modal visible={showAddPlan} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Новий абонемент</Text>
                <TouchableOpacity onPress={() => setShowAddPlan(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
              </View>
              {selectedClub && <Text style={s.modalSub}>Для: {branches.find(b => b.id === selectedClub)?.name || ''}</Text>}
              
              <Text style={s.inputLabel}>Назва абонементу</Text>
              <TextInput style={s.input} value={planName} onChangeText={setPlanName} placeholder="Місяць безліміт" testID="plan-name-input" />
              
              <Text style={s.inputLabel}>Тип абонементу</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.durationScroll}>
                {DURATION_OPTIONS.map((d, i) => (
                  <TouchableOpacity key={i} testID={`duration-${i}`}
                    style={[s.durationChip, planDuration.label === d.label && s.durationChipActive]}
                    onPress={() => setPlanDuration(d)}>
                    <Text style={[s.durationChipText, planDuration.label === d.label && s.durationChipTextActive]}>{d.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={s.inputLabel}>Ціна (₴)</Text>
              <TextInput style={s.input} value={planPrice} onChangeText={setPlanPrice} placeholder="2000" keyboardType="numeric" testID="plan-price-input" />
              
              <View style={s.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Знижка (%)</Text>
                  <TextInput style={s.input} value={planDiscount} onChangeText={setPlanDiscount} placeholder="0" keyboardType="numeric" testID="plan-discount-input" />
                </View>
                <View style={{ width: 12 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.inputLabel}>Заморозка (днів)</Text>
                  <TextInput style={s.input} value={planFreezeDays} onChangeText={setPlanFreezeDays} placeholder="0" keyboardType="numeric" testID="plan-freeze-input" />
                </View>
              </View>
              
              <View style={s.previewRow}>
                <Text style={s.previewLabel}>Ваш дохід: </Text>
                <Text style={s.previewValue}>{Math.round((Number(planPrice) || 0) * (1 - commissionPct / 100))} ₴</Text>
                <Text style={s.previewLabel}> (комісія {commissionPct}%)</Text>
              </View>
              <TouchableOpacity testID="confirm-add-plan" style={s.confirmBtn} onPress={handleAddPlan}>
                <Text style={s.confirmBtnText}>Додати абонемент</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══════ Upgrade SaaS Franchise Modal ═══════ */}
      <Modal visible={showUpgrade} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}>
            <View style={s.modalContent}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Тариф франшизи</Text>
                <TouchableOpacity onPress={() => setShowUpgrade(false)}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
              </View>
              <View style={s.infoBox}>
                <Ionicons name="information-circle" size={18} color="#7C3AED" />
                <Text style={[s.infoBoxText, { color: '#7C3AED' }]}>Оберіть тариф. Заявку буде надіслано адміністратору на розгляд.</Text>
              </View>
              {SAAS_PLANS.map(p => {
                const isCurrent = currentPlan === p.id;
                const isPending = upgradeStatus?.requestedPlan === p.id;
                return (
                  <TouchableOpacity key={p.id} testID={`saas-plan-${p.id}`}
                    style={[s.saasCard, isCurrent && s.saasCardCurrent, isPending && s.saasCardPending]}
                    onPress={() => handleUpgradeRequest(p.id)}
                    disabled={upgrading || isCurrent || !!upgradeStatus}>
                    <View style={s.saasHeader}>
                      <View style={[s.saasNameBadge, { backgroundColor: p.color }]}>
                        <Text style={s.saasNameText}>{p.name}</Text>
                      </View>
                      {isCurrent && <View style={s.currentBadge}><Text style={s.currentBadgeText}>Поточний</Text></View>}
                      {isPending && <View style={[s.currentBadge, { backgroundColor: '#F59E0B' }]}><Text style={s.currentBadgeText}>На розгляді</Text></View>}
                    </View>
                    <Text style={s.saasPrice}>{p.priceLabel}</Text>
                    <Text style={s.saasDetails}>Учнів: {String(p.students)} · Тренерів: {String(p.coaches)} · Філіалів: {String(p.branches)} · Комісія: {p.commission}</Text>
                    <View style={s.saasFeatures}>
                      {p.features.map((f, i) => (
                        <View key={i} style={s.saasFeatureRow}>
                          <Ionicons name="checkmark-circle" size={14} color={p.color} />
                          <Text style={s.saasFeatureText}>{f}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  // Franchise section
  franchiseSection: { backgroundColor: '#F5F3FF', borderRadius: 16, padding: 16, marginTop: 12, borderWidth: 1, borderColor: '#E9D5FF' },
  franchiseHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  franchiseTitle: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  currentPlanCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E9D5FF' },
  currentPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planBadgeLg: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  planBadgeLgText: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  currentPlanPrice: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  currentPlanDetails: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pendingRequestBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, marginTop: 10 },
  pendingRequestText: { fontSize: 13, color: '#92400E', flex: 1 },
  franchiseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 12, marginTop: 10, borderWidth: 1, borderColor: '#7C3AED' },
  franchiseBtnText: { fontSize: 15, fontWeight: '700', color: '#7C3AED' },
  // Sections
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F0F10', marginTop: 28, marginBottom: 14, letterSpacing: 0.3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  sectionSub: { fontSize: 13, color: '#6B7280', marginTop: -6 },
  planClubLabel: { fontSize: 13, color: '#6B7280', marginBottom: 10, marginTop: -4 },
  // Branch
  branchCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  branchCardSelected: { borderColor: '#E30613', backgroundColor: '#FEF2F2' },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  branchName: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1F2937' },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  branchCity: { fontSize: 13, color: '#6B7280', marginTop: 6 },
  branchSelected: { fontSize: 12, fontWeight: '700', color: '#E30613', marginTop: 6 },
  // Club plan
  clubPlanCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  clubPlanHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  clubPlanName: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  clubPlanMeta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  clubPlanRow: { flexDirection: 'row' },
  clubPlanItem: { flex: 1, alignItems: 'center' },
  cpLabel: { fontSize: 11, color: '#6B7280' },
  cpValue: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginTop: 2 },
  addPlanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E30613', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addPlanBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  emptyCard: { alignItems: 'center', padding: 32, backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  emptyText: { fontSize: 15, color: '#9CA3AF', marginTop: 8, fontWeight: '600' },
  emptyHint: { fontSize: 13, color: '#D1D5DB', marginTop: 4 },
  // Actions
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#E30613', borderRadius: 14, paddingVertical: 16, marginBottom: 10, marginTop: 8 },
  actionBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  modalSub: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#EFF6FF', borderRadius: 10, marginBottom: 16 },
  infoBoxText: { flex: 1, fontSize: 13, color: '#3B82F6' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  rowInputs: { flexDirection: 'row', marginTop: 4 },
  durationScroll: { marginBottom: 4 },
  durationChip: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  durationChipActive: { backgroundColor: '#FEF2F2', borderColor: '#E30613' },
  durationChipText: { fontSize: 13, color: '#4B5563', fontWeight: '600' },
  durationChipTextActive: { color: '#E30613' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 12, backgroundColor: '#F0FDF4', borderRadius: 10 },
  previewLabel: { fontSize: 13, color: '#6B7280' },
  previewValue: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  confirmBtn: { backgroundColor: '#E30613', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  // SaaS plans
  saasCard: { backgroundColor: '#F9FAFB', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  saasCardCurrent: { backgroundColor: '#F0FDF4', borderColor: '#10B981' },
  saasCardPending: { backgroundColor: '#FFFBEB', borderColor: '#F59E0B' },
  saasHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  saasNameBadge: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  saasNameText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  currentBadge: { backgroundColor: '#10B981', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  currentBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  saasPrice: { fontSize: 22, fontWeight: '700', color: '#0F0F10', marginBottom: 4 },
  saasDetails: { fontSize: 13, color: '#6B7280' },
  saasFeatures: { marginTop: 10, gap: 4 },
  saasFeatureRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saasFeatureText: { fontSize: 13, color: '#4B5563' },
});
