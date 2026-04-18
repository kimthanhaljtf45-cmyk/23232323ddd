import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

type DiscountRule = {
  _id: string;
  name: string;
  type: string;
  valueType: string;
  value: number;
  priority: number;
  isActive: boolean;
  isStackable: boolean;
  description?: string;
  usageCount: number;
  usageLimit?: number;
  perUserLimit?: number;
  group?: string;
  conditions?: {
    minChildren?: number;
    minMonthsActive?: number;
    medalTypes?: string[];
    programTypes?: string[];
    riskScoreAbove?: number;
    minActiveSubscriptions?: number;
  };
  promoCode?: string;
  startsAt?: string;
  expiresAt?: string;
};

type DiscountStats = {
  totalRules: number;
  activeRules: number;
  totalApplied: number;
  totalSaved: number;
  topDiscounts: Array<{ name: string; usageCount: number }>;
};

type DetailedStats = {
  totalUsed: number;
  totalDiscount: number;
  byType: Array<{ type: string; count: number; total: number }>;
  byMonth: Array<{ month: string; count: number; total: number }>;
};

const DISCOUNT_TYPE_LABELS: Record<string, string> = {
  REFERRAL: 'Реферальна',
  PROMO: 'Промокод',
  MANUAL: 'Ручна',
  FIRST_TIME: 'Перша оплата',
  FAMILY: 'Сімейна',
  LOYALTY: 'Лояльність',
  PERFORMANCE: 'Досягнення',
  VOLUME: 'Обсяг',
  RETENTION: 'Утримання',
  METABRAIN: 'AI Retention',
  SUBSCRIPTION: 'Підписка',
};

const DISCOUNT_TYPE_COLORS: Record<string, string> = {
  REFERRAL: '#8B5CF6',
  PROMO: '#F59E0B',
  MANUAL: '#6B7280',
  FIRST_TIME: '#10B981',
  FAMILY: '#3B82F6',
  LOYALTY: '#EC4899',
  PERFORMANCE: '#F97316',
  VOLUME: '#14B8A6',
  RETENTION: '#DC2626',
  METABRAIN: '#DC2626',
  SUBSCRIPTION: '#06B6D4',
};

const ALL_TYPES = ['MANUAL', 'PROMO', 'FAMILY', 'LOYALTY', 'FIRST_TIME', 'REFERRAL', 'PERFORMANCE', 'VOLUME', 'RETENTION', 'SUBSCRIPTION'];

type TabType = 'rules' | 'stats' | 'manual' | 'preview';

const emptyForm = {
  name: '',
  type: 'MANUAL',
  valueType: 'PERCENT',
  value: '10',
  description: '',
  priority: '10',
  isStackable: false,
  promoCode: '',
  usageLimit: '',
  perUserLimit: '',
  minChildren: '',
  minMonthsActive: '',
};

export default function AdminDiscountsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('rules');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Manual discount state
  const [manualForm, setManualForm] = useState({
    percent: '10',
    fixed: '',
    reason: '',
    usePercent: true,
  });

  // Preview state
  const [previewAmount, setPreviewAmount] = useState('2000');
  const [previewResult, setPreviewResult] = useState<any>(null);

  const { data: rules = [], isLoading, refetch } = useQuery<DiscountRule[]>({
    queryKey: ['admin-discount-rules'],
    queryFn: () => api.get('/admin/discounts?includeInactive=true'),
  });

  const { data: stats } = useQuery<DiscountStats>({
    queryKey: ['admin-discount-stats'],
    queryFn: () => api.get('/admin/discounts/stats'),
  });

  const { data: detailedStats } = useQuery<DetailedStats>({
    queryKey: ['admin-discount-detailed-stats'],
    queryFn: () => api.get('/admin/discounts/stats/detailed'),
    enabled: activeTab === 'stats',
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/discounts/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-rules'] });
      queryClient.invalidateQueries({ queryKey: ['admin-discount-stats'] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: { id?: string; payload: any }) =>
      data.id ? api.patch(`/admin/discounts/${data.id}`, data.payload) : api.post('/admin/discounts', data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-rules'] });
      queryClient.invalidateQueries({ queryKey: ['admin-discount-stats'] });
      setShowModal(false);
      setEditingRule(null);
      setForm(emptyForm);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/discounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-rules'] });
      queryClient.invalidateQueries({ queryKey: ['admin-discount-stats'] });
    },
  });

  const manualMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/discounts/manual', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-discount-rules'] });
      Alert.alert('Успіх', 'Ручну знижку створено');
      setManualForm({ percent: '10', fixed: '', reason: '', usePercent: true });
    },
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleOpenEdit = (rule: DiscountRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      type: rule.type,
      valueType: rule.valueType,
      value: rule.value.toString(),
      description: rule.description || '',
      priority: rule.priority.toString(),
      isStackable: rule.isStackable,
      promoCode: rule.promoCode || '',
      usageLimit: rule.usageLimit?.toString() || '',
      perUserLimit: rule.perUserLimit?.toString() || '',
      minChildren: rule.conditions?.minChildren?.toString() || '',
      minMonthsActive: rule.conditions?.minMonthsActive?.toString() || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { Alert.alert('Помилка', 'Введіть назву'); return; }
    const val = parseInt(form.value);
    if (isNaN(val) || val <= 0) { Alert.alert('Помилка', 'Введіть значення'); return; }

    const conditions: any = {};
    if (form.minChildren) conditions.minChildren = parseInt(form.minChildren);
    if (form.minMonthsActive) conditions.minMonthsActive = parseInt(form.minMonthsActive);

    const payload: any = {
      name: form.name,
      type: form.type,
      valueType: form.valueType,
      value: val,
      description: form.description,
      priority: parseInt(form.priority) || 10,
      isStackable: form.isStackable,
    };
    if (form.promoCode) payload.promoCode = form.promoCode.toUpperCase();
    if (form.usageLimit) payload.usageLimit = parseInt(form.usageLimit);
    if (form.perUserLimit) payload.perUserLimit = parseInt(form.perUserLimit);
    if (Object.keys(conditions).length > 0) payload.conditions = conditions;

    saveMutation.mutate({ id: editingRule?._id, payload });
  };

  const handleDelete = (rule: DiscountRule) => {
    Alert.alert('Видалити?', `"${rule.name}"`, [
      { text: 'Ні', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: () => deleteMutation.mutate(rule._id) },
    ]);
  };

  const handleManualApply = () => {
    if (!manualForm.reason.trim()) { Alert.alert('Помилка', 'Вкажіть причину'); return; }
    const data: any = { reason: manualForm.reason };
    if (manualForm.usePercent) {
      data.percent = parseInt(manualForm.percent) || 10;
    } else {
      data.fixed = parseInt(manualForm.fixed) || 100;
    }
    manualMutation.mutate(data);
  };

  const handlePreview = async () => {
    const amount = parseInt(previewAmount) || 2000;
    try {
      const result = await api.post('/admin/discounts/preview', { baseAmount: amount, context: 'SUBSCRIPTION' });
      setPreviewResult(result);
    } catch {
      setPreviewResult({ baseAmount: amount, discountAmount: 0, finalAmount: amount, appliedRules: [] });
    }
  };

  const renderTabs = () => (
    <View style={styles.tabBar}>
      {[
        { key: 'rules' as TabType, label: 'Правила', icon: 'list' as const },
        { key: 'stats' as TabType, label: 'Статистика', icon: 'bar-chart' as const },
        { key: 'manual' as TabType, label: 'Ручна', icon: 'hand-left' as const },
        { key: 'preview' as TabType, label: 'Прев\'ю', icon: 'eye' as const },
      ].map(tab => (
        <TouchableOpacity
          key={tab.key}
          testID={`tab-${tab.key}`}
          style={[styles.tab, activeTab === tab.key && styles.tabActive]}
          onPress={() => setActiveTab(tab.key)}
        >
          <Ionicons name={tab.icon} size={18} color={activeTab === tab.key ? '#DC2626' : '#71717A'} />
          <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderStatsCards = () => (
    <View style={styles.statsRow}>
      {[
        { value: stats?.totalRules || 0, label: 'Всього', color: '#DC2626' },
        { value: stats?.activeRules || 0, label: 'Активних', color: '#16A34A' },
        { value: stats?.totalApplied || 0, label: 'Застосовано', color: '#3B82F6' },
        { value: `${(stats?.totalSaved || 0).toLocaleString()}₴`, label: 'Збережено', color: '#F59E0B' },
      ].map((s, i) => (
        <View key={i} style={[styles.statCard, { borderLeftColor: s.color }]}>
          <Text style={styles.statValue}>{s.value}</Text>
          <Text style={styles.statLabel}>{s.label}</Text>
        </View>
      ))}
    </View>
  );

  const renderRuleCard = (rule: DiscountRule) => {
    const typeColor = DISCOUNT_TYPE_COLORS[rule.type] || '#6B7280';
    return (
      <TouchableOpacity key={rule._id} testID={`rule-card-${rule._id}`} style={[styles.ruleCard, !rule.isActive && styles.ruleCardInactive]} onPress={() => handleOpenEdit(rule)} activeOpacity={0.7}>
        <View style={styles.ruleHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeColor + '20', borderColor: typeColor + '40' }]}>
            <Text style={[styles.typeBadgeText, { color: typeColor }]}>{DISCOUNT_TYPE_LABELS[rule.type] || rule.type}</Text>
          </View>
          <View style={styles.ruleActions}>
            <Switch
              testID={`toggle-${rule._id}`}
              value={rule.isActive}
              onValueChange={() => toggleMutation.mutate(rule._id)}
              trackColor={{ true: '#DC2626', false: '#3F3F46' }}
              thumbColor="#FAFAFA"
            />
          </View>
        </View>
        <Text style={styles.ruleName}>{rule.name}</Text>
        {rule.description ? <Text style={styles.ruleDesc}>{rule.description}</Text> : null}
        <View style={styles.ruleDetails}>
          <View style={styles.detailChip}>
            <Ionicons name="pricetag" size={13} color="#DC2626" />
            <Text style={styles.detailText}>
              {rule.valueType === 'PERCENT' ? `-${rule.value}%` : rule.valueType === 'FIXED' ? `-${rule.value}₴` : `${rule.value} міс.`}
            </Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="stats-chart" size={13} color="#71717A" />
            <Text style={styles.detailText}>{rule.usageCount}{rule.usageLimit ? `/${rule.usageLimit}` : ''}</Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="layers" size={13} color="#71717A" />
            <Text style={styles.detailText}>P{rule.priority}</Text>
          </View>
          {rule.isStackable && (
            <View style={styles.detailChip}>
              <Ionicons name="copy" size={13} color="#3B82F6" />
              <Text style={[styles.detailText, { color: '#3B82F6' }]}>Stack</Text>
            </View>
          )}
        </View>
        {rule.conditions && (Object.keys(rule.conditions).length > 0) && (
          <View style={styles.condRow}>
            {rule.conditions.minChildren ? <Text style={styles.condText}>👨‍👧‍👦 Мін. {rule.conditions.minChildren} дітей</Text> : null}
            {rule.conditions.minMonthsActive ? <Text style={styles.condText}>📅 Мін. {rule.conditions.minMonthsActive} міс.</Text> : null}
          </View>
        )}
        <View style={styles.cardActions}>
          <TouchableOpacity testID={`edit-${rule._id}`} style={styles.cardActionBtn} onPress={() => handleOpenEdit(rule)}>
            <Ionicons name="create-outline" size={16} color="#A1A1AA" />
          </TouchableOpacity>
          <TouchableOpacity testID={`delete-${rule._id}`} style={styles.cardActionBtn} onPress={() => handleDelete(rule)}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRulesTab = () => (
    <>
      {renderStatsCards()}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Правила ({rules.length})</Text>
        <TouchableOpacity testID="add-discount-btn" onPress={handleOpenCreate} style={styles.addBtnSmall}>
          <Ionicons name="add" size={20} color="#FFF" />
          <Text style={styles.addBtnText}>Додати</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <ActivityIndicator color="#DC2626" style={{ marginTop: 40 }} />
      ) : rules.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="pricetag-outline" size={48} color="#3F3F46" />
          <Text style={styles.emptyText}>Немає правил</Text>
          <TouchableOpacity testID="seed-btn" style={styles.seedBtn} onPress={() => api.post('/admin/discounts/seed').then(() => refetch())}>
            <Text style={styles.seedBtnText}>Створити стандартні</Text>
          </TouchableOpacity>
        </View>
      ) : (
        rules.map(renderRuleCard)
      )}
    </>
  );

  const renderStatsTab = () => (
    <>
      {renderStatsCards()}
      <Text style={styles.sectionTitle}>Статистика по типах</Text>
      {detailedStats?.byType && detailedStats.byType.length > 0 ? (
        detailedStats.byType.map((t, i) => (
          <View key={i} style={styles.statsTypeRow}>
            <View style={[styles.statsTypeDot, { backgroundColor: DISCOUNT_TYPE_COLORS[t.type] || '#6B7280' }]} />
            <Text style={styles.statsTypeName}>{DISCOUNT_TYPE_LABELS[t.type] || t.type}</Text>
            <Text style={styles.statsTypeCount}>{t.count}x</Text>
            <Text style={styles.statsTypeAmount}>{t.total.toLocaleString()}₴</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noDataText}>Ще немає даних застосування</Text>
      )}
      {stats?.topDiscounts && stats.topDiscounts.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Топ правила</Text>
          {stats.topDiscounts.map((d, i) => (
            <View key={i} style={styles.topRow}>
              <Text style={styles.topRank}>#{i + 1}</Text>
              <Text style={styles.topName}>{d.name}</Text>
              <Text style={styles.topCount}>{d.usageCount}x</Text>
            </View>
          ))}
        </>
      )}
    </>
  );

  const renderManualTab = () => (
    <>
      <Text style={styles.sectionTitle}>Застосувати ручну знижку</Text>
      <View style={styles.manualCard}>
        <Text style={styles.manualDesc}>Створіть одноразову знижку для конкретного батька/учня</Text>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Тип знижки</Text>
          <View style={styles.typeToggle}>
            <TouchableOpacity
              testID="manual-percent-btn"
              style={[styles.typeToggleBtn, manualForm.usePercent && styles.typeToggleBtnActive]}
              onPress={() => setManualForm({ ...manualForm, usePercent: true })}
            >
              <Text style={[styles.typeToggleText, manualForm.usePercent && styles.typeToggleTextActive]}>%</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="manual-fixed-btn"
              style={[styles.typeToggleBtn, !manualForm.usePercent && styles.typeToggleBtnActive]}
              onPress={() => setManualForm({ ...manualForm, usePercent: false })}
            >
              <Text style={[styles.typeToggleText, !manualForm.usePercent && styles.typeToggleTextActive]}>₴</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.inputLabel}>{manualForm.usePercent ? 'Відсоток (%)' : 'Сума (₴)'}</Text>
        <TextInput
          testID="manual-value-input"
          style={styles.input}
          value={manualForm.usePercent ? manualForm.percent : manualForm.fixed}
          onChangeText={(t) => manualForm.usePercent
            ? setManualForm({ ...manualForm, percent: t })
            : setManualForm({ ...manualForm, fixed: t })}
          keyboardType="numeric"
          placeholderTextColor="#52525B"
        />
        <Text style={styles.inputLabel}>Причина</Text>
        <TextInput
          testID="manual-reason-input"
          style={styles.input}
          value={manualForm.reason}
          onChangeText={(t) => setManualForm({ ...manualForm, reason: t })}
          placeholder="Напр.: Retention знижка, VIP клієнт"
          placeholderTextColor="#52525B"
        />
        <TouchableOpacity testID="manual-apply-btn" style={styles.primaryBtn} onPress={handleManualApply} disabled={manualMutation.isPending}>
          {manualMutation.isPending ? <ActivityIndicator color="#FFF" /> : (
            <Text style={styles.primaryBtnText}>ЗАСТОСУВАТИ ЗНИЖКУ</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  const renderPreviewTab = () => (
    <>
      <Text style={styles.sectionTitle}>Превʼю знижки перед оплатою</Text>
      <View style={styles.previewCard}>
        <Text style={styles.previewDesc}>Перевірте, які знижки спрацюють для суми</Text>
        <Text style={styles.inputLabel}>Базова ціна (₴)</Text>
        <TextInput
          testID="preview-amount-input"
          style={styles.input}
          value={previewAmount}
          onChangeText={setPreviewAmount}
          keyboardType="numeric"
          placeholderTextColor="#52525B"
        />
        <TouchableOpacity testID="preview-calc-btn" style={styles.primaryBtn} onPress={handlePreview}>
          <Text style={styles.primaryBtnText}>РОЗРАХУВАТИ</Text>
        </TouchableOpacity>

        {previewResult && (
          <View style={styles.previewResult}>
            <View style={styles.previewLine}>
              <Text style={styles.previewLabel}>Базова ціна:</Text>
              <Text style={styles.previewValue}>{previewResult.baseAmount?.toLocaleString()}₴</Text>
            </View>
            {previewResult.appliedRules?.map((r: any, i: number) => (
              <View key={i} style={styles.previewLine}>
                <Text style={styles.previewDiscount}>{r.name}:</Text>
                <Text style={styles.previewDiscountValue}>
                  -{r.valueType === 'PERCENT' ? `${r.value}%` : `${r.discountAmount}₴`}
                </Text>
              </View>
            ))}
            <View style={styles.previewDivider} />
            <View style={styles.previewLine}>
              <Text style={styles.previewFinalLabel}>Фінальна ціна:</Text>
              <Text style={styles.previewFinalValue}>{previewResult.finalAmount?.toLocaleString()}₴</Text>
            </View>
            {previewResult.appliedRules?.length === 0 && (
              <Text style={styles.noDiscountText}>Жодна знижка не застосовується</Text>
            )}
          </View>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FAFAFA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Знижки</Text>
        <View style={{ width: 40 }} />
      </View>

      {renderTabs()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#DC2626" />}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === 'rules' && renderRulesTab()}
        {activeTab === 'stats' && renderStatsTab()}
        {activeTab === 'manual' && renderManualTab()}
        {activeTab === 'preview' && renderPreviewTab()}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingRule ? 'Редагувати' : 'Нове правило'}</Text>
                <TouchableOpacity testID="close-modal-btn" onPress={() => { setShowModal(false); setEditingRule(null); }}>
                  <Ionicons name="close" size={24} color="#A1A1AA" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.inputLabel}>Назва *</Text>
                <TextInput testID="form-name" style={styles.input} value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Знижка 10% зимова" placeholderTextColor="#52525B" />

                <Text style={styles.inputLabel}>Тип</Text>
                <View style={styles.typeGrid}>
                  {ALL_TYPES.map(type => (
                    <TouchableOpacity key={type} testID={`form-type-${type}`} style={[styles.typeChip, form.type === type && styles.typeChipActive]} onPress={() => setForm({ ...form, type })}>
                      <Text style={[styles.typeChipText, form.type === type && styles.typeChipTextActive]}>{DISCOUNT_TYPE_LABELS[type] || type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>Тип значення</Text>
                <View style={styles.typeGrid}>
                  {[{ k: 'PERCENT', l: '%' }, { k: 'FIXED', l: '₴' }, { k: 'FREE_PERIOD', l: 'Безкоштовно' }].map(v => (
                    <TouchableOpacity key={v.k} testID={`form-vt-${v.k}`} style={[styles.typeChip, form.valueType === v.k && styles.typeChipActive]} onPress={() => setForm({ ...form, valueType: v.k })}>
                      <Text style={[styles.typeChipText, form.valueType === v.k && styles.typeChipTextActive]}>{v.l}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.inputLabel}>Значення *</Text>
                    <TextInput testID="form-value" style={styles.input} value={form.value} onChangeText={(t) => setForm({ ...form, value: t })} keyboardType="numeric" placeholderTextColor="#52525B" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.inputLabel}>Пріоритет</Text>
                    <TextInput testID="form-priority" style={styles.input} value={form.priority} onChangeText={(t) => setForm({ ...form, priority: t })} keyboardType="numeric" placeholderTextColor="#52525B" />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Опис</Text>
                <TextInput testID="form-desc" style={[styles.input, { height: 56 }]} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="Опис" placeholderTextColor="#52525B" multiline />

                {form.type === 'PROMO' && (
                  <>
                    <Text style={styles.inputLabel}>Промокод</Text>
                    <TextInput testID="form-promo" style={styles.input} value={form.promoCode} onChangeText={(t) => setForm({ ...form, promoCode: t })} placeholder="WINTER2026" placeholderTextColor="#52525B" autoCapitalize="characters" />
                  </>
                )}

                <View style={styles.row}>
                  <View style={styles.halfCol}>
                    <Text style={styles.inputLabel}>Ліміт використань</Text>
                    <TextInput testID="form-limit" style={styles.input} value={form.usageLimit} onChangeText={(t) => setForm({ ...form, usageLimit: t })} keyboardType="numeric" placeholder="∞" placeholderTextColor="#52525B" />
                  </View>
                  <View style={styles.halfCol}>
                    <Text style={styles.inputLabel}>На користувача</Text>
                    <TextInput testID="form-per-user" style={styles.input} value={form.perUserLimit} onChangeText={(t) => setForm({ ...form, perUserLimit: t })} keyboardType="numeric" placeholder="∞" placeholderTextColor="#52525B" />
                  </View>
                </View>

                {/* Conditions */}
                <Text style={[styles.inputLabel, { marginTop: 20, fontSize: 14, color: '#FAFAFA' }]}>Умови</Text>
                {(form.type === 'FAMILY' || form.type === 'VOLUME') && (
                  <>
                    <Text style={styles.inputLabel}>Мін. кількість дітей</Text>
                    <TextInput testID="form-min-children" style={styles.input} value={form.minChildren} onChangeText={(t) => setForm({ ...form, minChildren: t })} keyboardType="numeric" placeholder="2" placeholderTextColor="#52525B" />
                  </>
                )}
                {form.type === 'LOYALTY' && (
                  <>
                    <Text style={styles.inputLabel}>Мін. місяців активності</Text>
                    <TextInput testID="form-min-months" style={styles.input} value={form.minMonthsActive} onChangeText={(t) => setForm({ ...form, minMonthsActive: t })} keyboardType="numeric" placeholder="3" placeholderTextColor="#52525B" />
                  </>
                )}

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Stackable</Text>
                  <Switch testID="form-stackable" value={form.isStackable} onValueChange={(v) => setForm({ ...form, isStackable: v })} trackColor={{ true: '#DC2626', false: '#3F3F46' }} thumbColor="#FAFAFA" />
                </View>
                <View style={{ height: 20 }} />
              </ScrollView>
              <TouchableOpacity testID="form-save-btn" style={styles.primaryBtn} onPress={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <ActivityIndicator color="#FFF" /> : (
                  <Text style={styles.primaryBtnText}>{editingRule ? 'ЗБЕРЕГТИ' : 'СТВОРИТИ'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FAFAFA', letterSpacing: 0.5 },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#27272A', backgroundColor: '#09090B' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#DC2626' },
  tabText: { fontSize: 12, color: '#71717A', fontWeight: '600' },
  tabTextActive: { color: '#DC2626' },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: '#18181B', borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#FAFAFA' },
  statLabel: { fontSize: 10, color: '#A1A1AA', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#FAFAFA', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 12 },
  addBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  ruleCard: { backgroundColor: '#18181B', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#27272A' },
  ruleCardInactive: { opacity: 0.45 },
  ruleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  typeBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  ruleActions: { flexDirection: 'row', alignItems: 'center' },
  ruleName: { fontSize: 15, fontWeight: '600', color: '#FAFAFA', marginBottom: 2 },
  ruleDesc: { fontSize: 12, color: '#71717A', marginBottom: 8 },
  ruleDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 },
  detailChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { fontSize: 12, color: '#A1A1AA' },
  condRow: { flexDirection: 'row', gap: 12, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#27272A' },
  condText: { fontSize: 11, color: '#71717A' },
  cardActions: { position: 'absolute', bottom: 12, right: 12, flexDirection: 'row', gap: 12 },
  cardActionBtn: { padding: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 15, color: '#52525B', marginTop: 12 },
  seedBtn: { marginTop: 16, backgroundColor: '#DC2626', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  seedBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  // Stats tab
  statsTypeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 10, padding: 14, marginBottom: 8, gap: 10 },
  statsTypeDot: { width: 10, height: 10, borderRadius: 5 },
  statsTypeName: { flex: 1, fontSize: 14, color: '#FAFAFA', fontWeight: '500' },
  statsTypeCount: { fontSize: 14, color: '#A1A1AA', fontWeight: '600' },
  statsTypeAmount: { fontSize: 14, color: '#DC2626', fontWeight: '700', minWidth: 80, textAlign: 'right' },
  noDataText: { fontSize: 14, color: '#52525B', textAlign: 'center', marginTop: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#18181B', gap: 12 },
  topRank: { fontSize: 14, color: '#DC2626', fontWeight: '800', width: 30 },
  topName: { flex: 1, fontSize: 14, color: '#FAFAFA' },
  topCount: { fontSize: 14, color: '#A1A1AA', fontWeight: '600' },
  // Manual tab
  manualCard: { backgroundColor: '#18181B', borderRadius: 12, padding: 20, marginTop: 4 },
  manualDesc: { fontSize: 13, color: '#71717A', marginBottom: 16 },
  typeToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#3F3F46' },
  typeToggleBtn: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#27272A' },
  typeToggleBtnActive: { backgroundColor: '#DC2626' },
  typeToggleText: { fontSize: 14, color: '#A1A1AA', fontWeight: '700' },
  typeToggleTextActive: { color: '#FFF' },
  // Preview tab
  previewCard: { backgroundColor: '#18181B', borderRadius: 12, padding: 20, marginTop: 4 },
  previewDesc: { fontSize: 13, color: '#71717A', marginBottom: 16 },
  previewResult: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#27272A' },
  previewLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  previewLabel: { fontSize: 14, color: '#A1A1AA' },
  previewValue: { fontSize: 14, color: '#FAFAFA', fontWeight: '600' },
  previewDiscount: { fontSize: 14, color: '#16A34A' },
  previewDiscountValue: { fontSize: 14, color: '#16A34A', fontWeight: '600' },
  previewDivider: { height: 1, backgroundColor: '#3F3F46', marginVertical: 8 },
  previewFinalLabel: { fontSize: 16, color: '#FAFAFA', fontWeight: '700' },
  previewFinalValue: { fontSize: 18, color: '#DC2626', fontWeight: '800' },
  noDiscountText: { fontSize: 13, color: '#52525B', textAlign: 'center', marginTop: 8 },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#18181B', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#FAFAFA' },
  modalScroll: { paddingHorizontal: 20, paddingTop: 4 },
  inputLabel: { fontSize: 11, fontWeight: '600', color: '#A1A1AA', marginBottom: 6, marginTop: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#27272A', borderRadius: 8, padding: 14, color: '#FAFAFA', fontSize: 15, borderWidth: 1, borderColor: '#3F3F46' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#27272A', borderWidth: 1, borderColor: '#3F3F46' },
  typeChipActive: { backgroundColor: '#DC262620', borderColor: '#DC2626' },
  typeChipText: { fontSize: 11, color: '#A1A1AA', fontWeight: '600' },
  typeChipTextActive: { color: '#DC2626' },
  row: { flexDirection: 'row', gap: 12 },
  halfCol: { flex: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingVertical: 4 },
  switchLabel: { fontSize: 14, color: '#FAFAFA' },
  primaryBtn: { backgroundColor: '#DC2626', margin: 20, padding: 16, borderRadius: 12, alignItems: 'center' },
  primaryBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
});
