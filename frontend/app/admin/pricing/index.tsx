import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Switch, Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

const PLAN_COLORS: Record<string, string> = { START: '#6B7280', PRO: '#2563EB', ENTERPRISE: '#7C3AED' };
const PLAN_ICONS: Record<string, string> = { START: 'rocket-outline', PRO: 'diamond-outline', ENTERPRISE: 'planet-outline' };

const FEATURE_LABELS: Record<string, string> = {
  automation: 'Automation Engine',
  ai: 'AI Engine',
  marketplace: 'Marketplace',
  branding: 'Кастом брендинг',
  push: 'Push-повідомлення',
  retention: 'Retention Dashboard',
  coachKpi: 'Coach KPI',
  unitEconomics: 'Unit Economics',
  integrations: 'Інтеграції',
};

type Plan = {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: string;
  limits: { students: number; coaches: number; branches: number };
  features: Record<string, boolean>;
  commission: { marketplace: number };
  trial: { enabled: boolean; days: number };
  isActive: boolean;
};

export default function PlatformPricingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['platform-plans'],
    queryFn: () => api.get('/platform/plans/all'),
  });

  const plans: Plan[] = data?.plans || [];

  const handleSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    try {
      await api.put(`/platform/plans/${editPlan.id}`, {
        name: editPlan.name,
        price: editPlan.price,
        limits: editPlan.limits,
        features: editPlan.features,
        commission: editPlan.commission,
        trial: editPlan.trial,
        isActive: editPlan.isActive,
      });
      Alert.alert('Збережено', `Тариф ${editPlan.name} оновлено`);
      setEditPlan(null);
      queryClient.invalidateQueries({ queryKey: ['platform-plans'] });
      refetch();
    } catch {
      Alert.alert('Помилка', 'Не вдалось зберегти');
    }
    setSaving(false);
  };

  const fmt = (v: number) => `${(v || 0).toLocaleString()} ₴`;

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.center}><ActivityIndicator size="large" color="#7C3AED" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="pricing-back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Платформа → Тарифи</Text>
          <Text style={s.headerSub}>SaaS pricing management</Text>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#7C3AED" />}
      >
        {/* Summary */}
        <View style={s.summaryRow}>
          {plans.map(p => {
            const color = PLAN_COLORS[p.id] || '#6B7280';
            return (
              <View key={p.id} style={[s.summaryCard, { borderTopColor: color }]}>
                <Text style={[s.summaryName, { color }]}>{p.name}</Text>
                <Text style={s.summaryPrice}>{fmt(p.price)}</Text>
                <Text style={s.summaryInterval}>/ міс</Text>
              </View>
            );
          })}
        </View>

        {/* Plan Cards */}
        {plans.map(p => {
          const color = PLAN_COLORS[p.id] || '#6B7280';
          return (
            <View key={p.id} testID={`plan-manage-${p.id}`} style={[s.planCard, !p.isActive && s.planInactive]}>
              {/* Plan Header */}
              <View style={s.planHeader}>
                <View style={[s.planIconWrap, { backgroundColor: color + '15' }]}>
                  <Ionicons name={(PLAN_ICONS[p.id] || 'rocket-outline') as any} size={28} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.planName, { color }]}>{p.name}</Text>
                  <Text style={s.planPrice}>{fmt(p.price)} / міс</Text>
                </View>
                {!p.isActive && <View style={s.inactiveBadge}><Text style={s.inactiveBadgeT}>Вимкнено</Text></View>}
              </View>

              {/* Limits */}
              <View style={s.blockRow}>
                <Text style={s.blockLabel}>📊 ЛІМІТИ</Text>
              </View>
              <View style={s.limitsRow}>
                <View style={s.limitItem}>
                  <Text style={s.limitNum}>{p.limits.students === 9999 ? '∞' : p.limits.students}</Text>
                  <Text style={s.limitLbl}>учнів</Text>
                </View>
                <View style={s.limitItem}>
                  <Text style={s.limitNum}>{p.limits.coaches === 9999 ? '∞' : p.limits.coaches}</Text>
                  <Text style={s.limitLbl}>тренерів</Text>
                </View>
                <View style={s.limitItem}>
                  <Text style={s.limitNum}>{p.limits.branches === 9999 ? '∞' : p.limits.branches}</Text>
                  <Text style={s.limitLbl}>філіалів</Text>
                </View>
              </View>

              {/* Features */}
              <View style={s.blockRow}>
                <Text style={s.blockLabel}>⚙️ ФУНКЦІЇ</Text>
              </View>
              <View style={s.featuresGrid}>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                  const active = p.features?.[key] === true;
                  return (
                    <View key={key} style={[s.featureChip, active ? s.featureOn : s.featureOff]}>
                      <Ionicons name={active ? 'checkmark-circle' : 'close-circle'} size={14} color={active ? '#16A34A' : '#D1D5DB'} />
                      <Text style={[s.featureChipT, active ? s.featureOnT : s.featureOffT]}>{label}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Commission */}
              <View style={s.blockRow}>
                <Text style={s.blockLabel}>💸 КОМІСІЇ</Text>
              </View>
              <View style={s.commissionRow}>
                <Text style={s.commLabel}>Маркетплейс</Text>
                <Text style={[s.commVal, { color }]}>{((p.commission?.marketplace || 0) * 100).toFixed(0)}%</Text>
              </View>

              {/* Trial */}
              {p.trial?.enabled && (
                <View style={s.trialRow}>
                  <Ionicons name="time-outline" size={16} color="#D97706" />
                  <Text style={s.trialText}>Trial: {p.trial.days} днів</Text>
                </View>
              )}

              {/* Edit Button */}
              <TouchableOpacity
                testID={`edit-plan-${p.id}`}
                style={[s.editBtn, { borderColor: color + '40' }]}
                onPress={() => setEditPlan({ ...p })}
              >
                <Ionicons name="pencil" size={16} color={color} />
                <Text style={[s.editBtnT, { color }]}>Редагувати</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      {editPlan && (
        <Modal visible animationType="slide" transparent>
          <View style={s.modalOverlay}>
            <View style={s.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Modal Header */}
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Редагування: {editPlan.name}</Text>
                  <TouchableOpacity testID="close-edit-modal" onPress={() => setEditPlan(null)}>
                    <Ionicons name="close" size={28} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Price */}
                <Text style={s.fieldLabel}>💰 Ціна (₴/міс)</Text>
                <TextInput
                  testID="edit-price-input"
                  style={s.input}
                  value={String(editPlan.price)}
                  onChangeText={v => setEditPlan({ ...editPlan, price: parseInt(v) || 0 })}
                  keyboardType="number-pad"
                />

                {/* Limits */}
                <Text style={s.fieldLabel}>📊 Ліміти</Text>
                {['students', 'coaches', 'branches'].map(key => {
                  const label = key === 'students' ? 'Учні' : key === 'coaches' ? 'Тренери' : 'Філіали';
                  return (
                    <View key={key} style={s.limitEditRow}>
                      <Text style={s.limitEditLabel}>{label}</Text>
                      <TextInput
                        testID={`edit-limit-${key}`}
                        style={s.limitInput}
                        value={String(editPlan.limits[key as keyof typeof editPlan.limits])}
                        onChangeText={v => setEditPlan({
                          ...editPlan,
                          limits: { ...editPlan.limits, [key]: parseInt(v) || 0 }
                        })}
                        keyboardType="number-pad"
                      />
                    </View>
                  );
                })}

                {/* Features */}
                <Text style={s.fieldLabel}>⚙️ Функції</Text>
                {Object.entries(FEATURE_LABELS).map(([key, label]) => (
                  <View key={key} style={s.featureEditRow}>
                    <Text style={s.featureEditLabel}>{label}</Text>
                    <Switch
                      testID={`toggle-feature-${key}`}
                      value={editPlan.features?.[key] === true}
                      onValueChange={v => setEditPlan({
                        ...editPlan,
                        features: { ...editPlan.features, [key]: v }
                      })}
                      trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                      thumbColor={editPlan.features?.[key] ? '#16A34A' : '#9CA3AF'}
                    />
                  </View>
                ))}

                {/* Commission */}
                <Text style={s.fieldLabel}>💸 Комісія маркетплейсу (%)</Text>
                <TextInput
                  testID="edit-commission-input"
                  style={s.input}
                  value={String(((editPlan.commission?.marketplace || 0) * 100).toFixed(0))}
                  onChangeText={v => setEditPlan({
                    ...editPlan,
                    commission: { ...editPlan.commission, marketplace: (parseInt(v) || 0) / 100 }
                  })}
                  keyboardType="number-pad"
                />

                {/* Trial */}
                <Text style={s.fieldLabel}>⏱ Trial</Text>
                <View style={s.featureEditRow}>
                  <Text style={s.featureEditLabel}>Увімкнено</Text>
                  <Switch
                    testID="toggle-trial"
                    value={editPlan.trial?.enabled === true}
                    onValueChange={v => setEditPlan({
                      ...editPlan,
                      trial: { ...editPlan.trial, enabled: v }
                    })}
                    trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                    thumbColor={editPlan.trial?.enabled ? '#16A34A' : '#9CA3AF'}
                  />
                </View>
                {editPlan.trial?.enabled && (
                  <View style={s.limitEditRow}>
                    <Text style={s.limitEditLabel}>Дні</Text>
                    <TextInput
                      testID="edit-trial-days"
                      style={s.limitInput}
                      value={String(editPlan.trial?.days || 7)}
                      onChangeText={v => setEditPlan({
                        ...editPlan,
                        trial: { ...editPlan.trial, days: parseInt(v) || 7 }
                      })}
                      keyboardType="number-pad"
                    />
                  </View>
                )}

                {/* Status */}
                <Text style={s.fieldLabel}>🟢 Статус</Text>
                <View style={s.featureEditRow}>
                  <Text style={s.featureEditLabel}>Активний</Text>
                  <Switch
                    testID="toggle-plan-active"
                    value={editPlan.isActive !== false}
                    onValueChange={v => setEditPlan({ ...editPlan, isActive: v })}
                    trackColor={{ false: '#E5E7EB', true: '#86EFAC' }}
                    thumbColor={editPlan.isActive !== false ? '#16A34A' : '#9CA3AF'}
                  />
                </View>

                {/* Save */}
                <TouchableOpacity
                  testID="save-plan-btn"
                  style={[s.saveBtn, saving && s.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={s.saveBtnT}>Зберегти</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  headerSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  // Summary
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderTopWidth: 3, alignItems: 'center' },
  summaryName: { fontSize: 13, fontWeight: '700' },
  summaryPrice: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  summaryInterval: { fontSize: 11, color: '#9CA3AF' },
  // Plan Card
  planCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  planInactive: { opacity: 0.6 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  planIconWrap: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  planName: { fontSize: 20, fontWeight: '800' },
  planPrice: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  inactiveBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  inactiveBadgeT: { fontSize: 11, fontWeight: '600', color: '#DC2626' },
  // Blocks
  blockRow: { marginTop: 18, marginBottom: 8 },
  blockLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  // Limits
  limitsRow: { flexDirection: 'row', gap: 12 },
  limitItem: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, alignItems: 'center' },
  limitNum: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
  limitLbl: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  // Features
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  featureOn: { backgroundColor: '#F0FDF4' },
  featureOff: { backgroundColor: '#F9FAFB' },
  featureChipT: { fontSize: 11, fontWeight: '600' },
  featureOnT: { color: '#16A34A' },
  featureOffT: { color: '#D1D5DB' },
  // Commission
  commissionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14 },
  commLabel: { fontSize: 14, color: '#6B7280' },
  commVal: { fontSize: 20, fontWeight: '800' },
  // Trial
  trialRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 10, padding: 10, marginTop: 12 },
  trialText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
  // Edit
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5 },
  editBtnT: { fontSize: 15, fontWeight: '700' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '700', color: '#0F172A' },
  limitEditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  limitEditLabel: { fontSize: 15, color: '#374151' },
  limitInput: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, width: 100, fontSize: 16, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  featureEditRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  featureEditLabel: { fontSize: 14, color: '#374151' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7C3AED', paddingVertical: 16, borderRadius: 14, marginTop: 24 },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnT: { fontSize: 17, fontWeight: '700', color: '#fff' },
});
