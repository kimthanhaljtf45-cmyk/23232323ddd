import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/lib/api';

/**
 * ADMIN PLANS - Tariff Management
 * 
 * Features:
 * - List all plans
 * - Edit prices
 * - Enable/disable plans
 * - Create new plans
 */

interface Plan {
  id: string;
  name: string;
  type: 'MONTH' | 'HALF_YEAR' | 'YEAR';
  durationMonths: number;
  basePrice: number;
  discountPercent: number;
  finalPrice: number;
  freezeDaysAllowed: number;
  isActive: boolean;
}

export default function AdminPlansScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [editedPrice, setEditedPrice] = useState('');
  const [editedDiscount, setEditedDiscount] = useState('');
  const [editedFreezeDays, setEditedFreezeDays] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPlans = useCallback(async () => {
    try {
      const response = await api.get('/admin/subscriptions/plans');
      setPlans(response || []);
    } catch (error) {
      console.log('Error fetching plans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlans();
    setRefreshing(false);
  }, [fetchPlans]);

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan);
    setEditedPrice(plan.basePrice.toString());
    setEditedDiscount(plan.discountPercent.toString());
    setEditedFreezeDays(plan.freezeDaysAllowed.toString());
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    if (!selectedPlan) return;

    const basePrice = parseInt(editedPrice) || 0;
    const discountPercent = parseInt(editedDiscount) || 0;
    const freezeDaysAllowed = parseInt(editedFreezeDays) || 0;

    if (basePrice <= 0) {
      Alert.alert('Помилка', 'Ціна має бути більше 0');
      return;
    }

    setSaving(true);
    try {
      await api.put(`/admin/subscriptions/plans/${selectedPlan.id}`, {
        basePrice,
        discountPercent,
        freezeDaysAllowed,
      });
      Alert.alert('Успіх', 'Тариф оновлено');
      setEditModalVisible(false);
      fetchPlans();
    } catch (error: any) {
      Alert.alert('Помилка', error.message || 'Не вдалося оновити');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: Plan) => {
    const action = plan.isActive ? 'деактивувати' : 'активувати';
    Alert.alert(
      `${plan.isActive ? 'Деактивувати' : 'Активувати'} тариф`,
      `Ви впевнені, що хочете ${action} тариф "${plan.name}"?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Підтвердити',
          onPress: async () => {
            try {
              await api.put(`/admin/subscriptions/plans/${plan.id}`, {
                isActive: !plan.isActive,
              });
              Alert.alert('Успіх', `Тариф ${plan.isActive ? 'деактивовано' : 'активовано'}`);
              fetchPlans();
            } catch (error: any) {
              Alert.alert('Помилка', error.message || 'Не вдалося оновити');
            }
          },
        },
      ]
    );
  };

  const getPlanIcon = (type: string) => {
    switch (type) {
      case 'MONTH': return 'calendar-outline';
      case 'HALF_YEAR': return 'calendar';
      case 'YEAR': return 'calendar-sharp';
      default: return 'pricetag';
    }
  };

  const getPlanColor = (type: string) => {
    switch (type) {
      case 'MONTH': return '#3B82F6';
      case 'HALF_YEAR': return '#8B5CF6';
      case 'YEAR': return '#22C55E';
      default: return '#6B7280';
    }
  };

  const formatCurrency = (amount: number) => amount.toLocaleString('uk-UA') + ' ₴';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#7C3AED']} />
        }
      >
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#0369A1" />
          <Text style={styles.infoText}>
            Тарифи визначають вартість підписок. Знижки застосовуються автоматично для довших планів.
          </Text>
        </View>

        {/* Plans List */}
        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Немає тарифів</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View 
              key={plan.id} 
              style={[
                styles.card,
                !plan.isActive && styles.cardInactive
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.planIcon, { backgroundColor: getPlanColor(plan.type) + '20' }]}>
                  <Ionicons name={getPlanIcon(plan.type) as any} size={24} color={getPlanColor(plan.type)} />
                </View>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDuration}>{plan.durationMonths} міс.</Text>
                </View>
                {!plan.isActive && (
                  <View style={styles.inactiveBadge}>
                    <Text style={styles.inactiveBadgeText}>Неактивний</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.priceSection}>
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Базова ціна</Text>
                    <Text style={styles.priceValue}>{formatCurrency(plan.basePrice)}</Text>
                  </View>
                  {plan.discountPercent > 0 && (
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Знижка</Text>
                      <Text style={[styles.priceValue, { color: '#22C55E' }]}>-{plan.discountPercent}%</Text>
                    </View>
                  )}
                  <View style={[styles.priceRow, styles.finalRow]}>
                    <Text style={styles.finalLabel}>Фінальна ціна</Text>
                    <Text style={styles.finalValue}>{formatCurrency(plan.finalPrice)}</Text>
                  </View>
                </View>

                <View style={styles.featureRow}>
                  <Ionicons name="snow" size={16} color="#6B7280" />
                  <Text style={styles.featureText}>
                    Заморозка: до {plan.freezeDaysAllowed} днів
                  </Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Pressable
                  style={[styles.cardAction, { backgroundColor: '#7C3AED20' }]}
                  onPress={() => handleEdit(plan)}
                >
                  <Ionicons name="pencil" size={16} color="#7C3AED" />
                  <Text style={[styles.cardActionText, { color: '#7C3AED' }]}>Редагувати</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.cardAction,
                    { backgroundColor: plan.isActive ? '#FEE2E220' : '#DCFCE7' }
                  ]}
                  onPress={() => handleToggleActive(plan)}
                >
                  <Ionicons 
                    name={plan.isActive ? 'pause' : 'play'} 
                    size={16} 
                    color={plan.isActive ? '#991B1B' : '#166534'} 
                  />
                  <Text style={[
                    styles.cardActionText, 
                    { color: plan.isActive ? '#991B1B' : '#166534' }
                  ]}>
                    {plan.isActive ? 'Деактивувати' : 'Активувати'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Редагувати тариф</Text>
              <Pressable onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </Pressable>
            </View>

            {selectedPlan && (
              <>
                <Text style={styles.modalPlanName}>{selectedPlan.name}</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Базова ціна (грн)</Text>
                  <TextInput
                    style={styles.input}
                    value={editedPrice}
                    onChangeText={setEditedPrice}
                    keyboardType="numeric"
                    placeholder="2000"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Знижка (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={editedDiscount}
                    onChangeText={setEditedDiscount}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Днів заморозки</Text>
                  <TextInput
                    style={styles.input}
                    value={editedFreezeDays}
                    onChangeText={setEditedFreezeDays}
                    keyboardType="numeric"
                    placeholder="7"
                  />
                </View>

                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Фінальна ціна:</Text>
                  <Text style={styles.previewValue}>
                    {formatCurrency(
                      (parseInt(editedPrice) || 0) * (1 - (parseInt(editedDiscount) || 0) / 100)
                    )}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    style={[styles.modalBtn, styles.cancelBtn]}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.cancelBtnText}>Скасувати</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, styles.saveBtn]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.saveBtnText}>Зберегти</Text>
                    )}
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  // Info Banner
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 13, color: '#0369A1', lineHeight: 18 },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  // Card
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardInactive: { opacity: 0.6 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  planIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planInfo: { flex: 1 },
  planName: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  planDuration: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  inactiveBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  inactiveBadgeText: { fontSize: 11, fontWeight: '600', color: '#991B1B' },
  // Body
  cardBody: {},
  priceSection: { marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  priceLabel: { fontSize: 14, color: '#6B7280' },
  priceValue: { fontSize: 14, color: '#0F0F10', fontWeight: '500' },
  finalRow: { borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8, marginTop: 4 },
  finalLabel: { fontSize: 14, fontWeight: '600', color: '#0F0F10' },
  finalValue: { fontSize: 18, fontWeight: '700', color: '#7C3AED' },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  featureText: { fontSize: 13, color: '#6B7280' },
  // Actions
  cardActions: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 12 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  cardActionText: { fontSize: 12, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  modalPlanName: { fontSize: 16, fontWeight: '600', color: '#7C3AED', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F0F10',
  },
  previewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  previewLabel: { fontSize: 14, color: '#6B7280' },
  previewValue: { fontSize: 20, fontWeight: '700', color: '#7C3AED' },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#F3F4F6' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  saveBtn: { backgroundColor: '#7C3AED' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
