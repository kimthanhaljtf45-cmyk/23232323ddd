import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type ClubPlan = 'START' | 'PRO' | 'ENTERPRISE';

interface Club {
  id: string;
  slug?: string;
  name: string;
  plan: ClubPlan;
  status: string;
  isActive: boolean;
  studentCount: number;
  coachCount: number;
  totalRevenue: number;
  monthlyRevenue: number;
  priceMonthly: number;
  email?: string;
  phone?: string;
  city?: string;
  primaryColor?: string;
  createdAt: string;
}

interface SaasOverview {
  totalClubs: number;
  activeClubs: number;
  byPlan: Record<string, number>;
  totalMRR: number;
  totalStudents: number;
}

const PLAN_COLORS: Record<ClubPlan, string> = {
  START: '#6B7280',
  PRO: '#3B82F6',
  ENTERPRISE: '#8B5CF6',
};

const PLAN_LABELS: Record<ClubPlan, string> = {
  START: 'Старт',
  PRO: 'Про',
  ENTERPRISE: 'All',
};

const PLAN_PRICES: Record<ClubPlan, number> = {
  START: 990,
  PRO: 2490,
  ENTERPRISE: 4990,
};

// Validation helpers
function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  return /^\+?[0-9]{10,15}$/.test(cleaned);
}

function validateSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length >= 3;
}

export default function TenantsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [newClub, setNewClub] = useState({
    slug: '',
    name: '',
    brandName: '',
    email: '',
    phone: '',
    city: '',
    plan: 'START' as ClubPlan,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery<SaasOverview>({
    queryKey: ['clubs-overview'],
    queryFn: () => api.get('/admin/clubs/overview'),
  });

  const { data: clubs, isLoading: clubsLoading, refetch } = useQuery<Club[]>({
    queryKey: ['admin-clubs'],
    queryFn: () => api.get('/admin/clubs'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post('/admin/clubs', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['clubs-overview'] });
      setShowCreateModal(false);
      resetForm();
      Alert.alert('Успіх', 'Клуб успішно створено!');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message || 'Помилка створення клубу';
      setApiError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const resetForm = () => {
    setNewClub({ slug: '', name: '', brandName: '', email: '', phone: '', city: '', plan: 'START' });
    setErrors({});
    setApiError('');
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!newClub.name.trim() || newClub.name.trim().length < 2) {
      newErrors.name = 'Назва клубу обов\'язкова (мін. 2 символи)';
    }

    if (newClub.email && !validateEmail(newClub.email)) {
      newErrors.email = 'Невірний формат email (напр. owner@club.com)';
    }

    if (newClub.phone && !validatePhone(newClub.phone)) {
      newErrors.phone = 'Невірний формат телефону (напр. +380991234567)';
    }

    if (newClub.slug && !validateSlug(newClub.slug)) {
      newErrors.slug = 'Slug: мін. 3 символи, тільки a-z, 0-9, дефіс';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = () => {
    setApiError('');
    if (!validateForm()) return;

    // Auto-generate slug from name if not provided
    const slug = newClub.slug || newClub.name.toLowerCase()
      .replace(/[^a-zа-яіїєґ0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

    createMutation.mutate({
      name: newClub.name.trim(),
      plan: newClub.plan,
      email: newClub.email || undefined,
      phone: newClub.phone || undefined,
      city: newClub.city || undefined,
    });
  };

  const isLoading = overviewLoading || clubsLoading;

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('uk-UA') + ' ₴';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Клуби (SaaS)</Text>
        <TouchableOpacity testID="add-club-btn" onPress={() => { resetForm(); setShowCreateModal(true); }} style={styles.addBtn}>
          <Ionicons name="add" size={28} color="#E30613" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* SaaS Overview */}
        {overview && (
          <View style={styles.overviewCard}>
            <Text style={styles.overviewTitle}>SaaS Overview</Text>
            <View style={styles.overviewGrid}>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewValue}>{overview.totalClubs}</Text>
                <Text style={styles.overviewLabel}>Всього клубів</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewValue, { color: '#22C55E' }]}>{overview.activeClubs}</Text>
                <Text style={styles.overviewLabel}>Активні</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={[styles.overviewValue, { color: '#3B82F6' }]}>{formatCurrency(overview.totalMRR)}</Text>
                <Text style={styles.overviewLabel}>MRR</Text>
              </View>
              <View style={styles.overviewItem}>
                <Text style={styles.overviewValue}>{overview.totalStudents}</Text>
                <Text style={styles.overviewLabel}>Учнів</Text>
              </View>
            </View>
            <View style={styles.plansRow}>
              {(['START', 'PRO', 'ENTERPRISE'] as ClubPlan[]).map(plan => (
                <View key={plan} style={[styles.planBadge, { backgroundColor: PLAN_COLORS[plan] + '20' }]}>
                  <Text style={[styles.planBadgeText, { color: PLAN_COLORS[plan] }]}>
                    {PLAN_LABELS[plan]}: {overview.byPlan?.[plan] || 0}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Clubs List */}
        <Text style={styles.sectionTitle}>Список клубів</Text>
        {clubs?.map(club => (
          <TouchableOpacity
            key={club.id}
            style={styles.tenantCard}
            onPress={() => router.push(`/admin/tenants/${club.id}` as any)}
            testID={`club-card-${club.id}`}
            activeOpacity={0.7}
          >
            <View style={styles.tenantHeader}>
              <View style={styles.tenantInfo}>
                <Text style={styles.tenantName}>{club.name}</Text>
                {club.slug && <Text style={styles.tenantSlug}>@{club.slug}</Text>}
              </View>
              <View style={[styles.planChip, { backgroundColor: PLAN_COLORS[club.plan] || '#6B7280' }]}>
                <Text style={styles.planChipText}>{club.plan}</Text>
              </View>
            </View>
            <View style={styles.tenantStats}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={16} color="#6B7280" />
                <Text style={styles.statText}>{club.studentCount || 0} учнів</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="fitness-outline" size={16} color="#6B7280" />
                <Text style={styles.statText}>{club.coachCount || 0} тренерів</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="cash-outline" size={16} color="#22C55E" />
                <Text style={[styles.statText, { color: '#22C55E' }]}>
                  {formatCurrency(club.priceMonthly || 0)}/міс
                </Text>
              </View>
            </View>
            <View style={styles.tenantFooter}>
              <View style={[styles.statusBadge, { backgroundColor: club.status === 'ACTIVE' ? '#DCFCE7' : '#FEE2E2' }]}>
                <View style={[styles.statusDot, { backgroundColor: club.status === 'ACTIVE' ? '#22C55E' : '#EF4444' }]} />
                <Text style={[styles.statusText, { color: club.status === 'ACTIVE' ? '#166534' : '#991B1B' }]}>
                  {club.status === 'ACTIVE' ? 'Активний' : club.status}
                </Text>
              </View>
              {club.city && <Text style={styles.cityText}>{club.city}</Text>}
            </View>
          </TouchableOpacity>
        ))}

        {clubs?.length === 0 && !isLoading && (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>Немає клубів</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => { resetForm(); setShowCreateModal(true); }}>
              <Text style={styles.createBtnText}>Створити перший клуб</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create Club Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Новий клуб</Text>
                <TouchableOpacity testID="close-modal-btn" onPress={() => setShowCreateModal(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
                {/* API Error */}
                {apiError ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" />
                    <Text style={styles.errorBannerText}>{apiError}</Text>
                  </View>
                ) : null}

                {/* Name (required) */}
                <Text style={styles.inputLabel}>Назва клубу *</Text>
                <TextInput
                  testID="club-name-input"
                  style={[styles.input, errors.name ? styles.inputError : null]}
                  value={newClub.name}
                  onChangeText={text => { setNewClub(prev => ({ ...prev, name: text })); setErrors(prev => ({ ...prev, name: '' })); }}
                  placeholder="Мій спортивний клуб"
                />
                {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}

                {/* Email */}
                <Text style={styles.inputLabel}>Email власника</Text>
                <TextInput
                  testID="club-email-input"
                  style={[styles.input, errors.email ? styles.inputError : null]}
                  value={newClub.email}
                  onChangeText={text => { setNewClub(prev => ({ ...prev, email: text })); setErrors(prev => ({ ...prev, email: '' })); }}
                  placeholder="owner@club.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}

                {/* Phone */}
                <Text style={styles.inputLabel}>Телефон власника</Text>
                <TextInput
                  testID="club-phone-input"
                  style={[styles.input, errors.phone ? styles.inputError : null]}
                  value={newClub.phone}
                  onChangeText={text => { setNewClub(prev => ({ ...prev, phone: text })); setErrors(prev => ({ ...prev, phone: '' })); }}
                  placeholder="+380991234567"
                  keyboardType="phone-pad"
                />
                {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}

                {/* City */}
                <Text style={styles.inputLabel}>Місто</Text>
                <TextInput
                  testID="club-city-input"
                  style={styles.input}
                  value={newClub.city}
                  onChangeText={text => setNewClub(prev => ({ ...prev, city: text }))}
                  placeholder="Київ"
                />

                {/* Plan Selection */}
                <Text style={styles.inputLabel}>Тарифний план</Text>
                <View style={styles.planCards}>
                  {(['START', 'PRO', 'ENTERPRISE'] as ClubPlan[]).map(plan => {
                    const selected = newClub.plan === plan;
                    return (
                      <TouchableOpacity
                        key={plan}
                        testID={`plan-${plan}`}
                        style={[styles.planCard, selected && { borderColor: PLAN_COLORS[plan], borderWidth: 2, backgroundColor: PLAN_COLORS[plan] + '10' }]}
                        onPress={() => setNewClub(prev => ({ ...prev, plan }))}
                      >
                        <Text style={[styles.planCardTitle, selected && { color: PLAN_COLORS[plan] }]}>{PLAN_LABELS[plan]}</Text>
                        <Text style={styles.planCardPrice}>{PLAN_PRICES[plan]} ₴/міс</Text>
                        <Text style={styles.planCardFeatures}>
                          {plan === 'START' ? '50 учнів • 3 тренери' : plan === 'PRO' ? '200 учнів • 10 тренерів' : 'Без лімітів'}
                        </Text>
                        {selected && (
                          <View style={[styles.planCheck, { backgroundColor: PLAN_COLORS[plan] }]}>
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ height: 20 }} />
              </ScrollView>

              <TouchableOpacity
                testID="create-club-submit-btn"
                style={[styles.submitBtn, !newClub.name.trim() && styles.submitBtnDisabled]}
                onPress={handleCreate}
                disabled={!newClub.name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>Створити клуб</Text>
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
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#0F0F10', textAlign: 'center' },
  addBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  overviewCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16 },
  overviewTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10', marginBottom: 16 },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  overviewItem: { width: '50%', marginBottom: 12 },
  overviewValue: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  overviewLabel: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  plansRow: { flexDirection: 'row', gap: 8 },
  planBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  planBadgeText: { fontSize: 13, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 12 },
  tenantCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  tenantHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tenantInfo: { flex: 1 },
  tenantName: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  tenantSlug: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  planChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  planChipText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  tenantStats: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, color: '#6B7280' },
  tenantFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600' },
  cityText: { fontSize: 13, color: '#6B7280' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
  createBtn: { marginTop: 16, backgroundColor: '#E30613', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  createBtnText: { color: '#FFFFFF', fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  modalForm: { padding: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, marginBottom: 4, borderWidth: 1.5, borderColor: 'transparent' },
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  fieldError: { fontSize: 12, color: '#EF4444', marginBottom: 12, marginLeft: 4 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FECACA' },
  errorBannerText: { fontSize: 13, color: '#DC2626', flex: 1 },
  planCards: { gap: 10, marginBottom: 8 },
  planCard: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, padding: 16, position: 'relative' },
  planCardTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  planCardPrice: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 4 },
  planCardFeatures: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  planCheck: { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  submitBtn: { backgroundColor: '#E30613', margin: 20, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#D1D5DB' },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
