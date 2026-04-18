import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

const ACCENT = '#7C3AED';
const BELT_COLORS: Record<string, string> = {
  WHITE: '#E5E7EB', YELLOW: '#FCD34D', ORANGE: '#FB923C',
  GREEN: '#22C55E', BLUE: '#3B82F6', BROWN: '#92400E', BLACK: '#1F2937',
};

function Toast({ visible, message, type }: { visible: boolean; message: string; type: 'success' | 'error' | 'info' }) {
  if (!visible) return null;
  const bg = type === 'success' ? '#22C55E' : type === 'error' ? '#EF4444' : '#3B82F6';
  const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';
  return (
    <View style={[st.toast, { backgroundColor: bg }]}>
      <Ionicons name={icon as any} size={20} color="#fff" />
      <Text style={st.toastText}>{message}</Text>
    </View>
  );
}

export default function ParentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [parentData, setParentData] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const });
  const [messageModal, setMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const load = useCallback(async () => {
    try {
      const [parentsRes, subsRes] = await Promise.all([
        api.get('/admin/parents').catch(() => []),
        api.get('/billing/subscriptions').catch(() => []),
      ]);
      const found = (parentsRes || []).find((p: any) => (p.id || p._id) === id);
      setParentData(found || null);
      setSubscriptions(subsRes || []);

      if (found?.children?.length > 0) {
        const childrenData = await Promise.all(
          found.children.slice(0, 5).map((ch: any) =>
            api.get(`/children/${ch.id}`).catch(() => ({ ...ch }))
          )
        );
        setChildren(childrenData.filter(Boolean));
      }
    } catch (e) {
      console.error('Load parent error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // === ACTIONS ===

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setActionLoading('message');
    try {
      const thread = await api.post('/communication/threads', { participantIds: [id] });
      await api.post('/communication/messages', { threadId: thread.id, text: messageText.trim() });
      setMessageModal(false);
      setMessageText('');
      showToast('Повідомлення відправлено!', 'success');
    } catch (e: any) {
      showToast(e?.response?.data?.message || 'Помилка відправки', 'error');
    } finally {
      setActionLoading('');
    }
  };

  const handleSendOffer = () => {
    Alert.alert(
      'Спецпропозиція',
      `Відправити персональну пропозицію для ${parentData?.name || 'батька'}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Відправити -15%',
          onPress: async () => {
            setActionLoading('offer');
            try {
              // Apply discount to each child's subscription
              for (const child of children) {
                const sub = subscriptions.find((s: any) => s.childId === (child.id || child._id));
                if (sub) {
                  const newPrice = Math.round(sub.price * 0.85);
                  await api.patch(`/billing/subscriptions/${sub._id}`, { price: newPrice });
                }
              }
              showToast('Спецпропозицію -15% відправлено!', 'success');
            } catch (e: any) {
              showToast('Помилка', 'error');
            } finally {
              setActionLoading('');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.center}><ActivityIndicator size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  if (!parentData) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={st.errText}>Не вдалося завантажити</Text>
          <TouchableOpacity style={st.retryBtn} onPress={load}>
            <Text style={st.retryBtnText}>Повторити</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const name = parentData.name || 'Невідомий';
  const phone = parentData.phone || '';
  const debt = parentData.debt || 0;
  const childrenCount = parentData.childrenCount || 0;

  // Calculate total monthly spend
  const totalMonthly = children.reduce((sum, ch) => {
    const sub = subscriptions.find((s: any) => s.childId === (ch.id || ch._id));
    return sum + (sub?.price || 0);
  }, 0);

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />

      <View style={st.header}>
        <TouchableOpacity testID="parent-profile-back" onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Профіль батька</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={st.profileHeader}>
          <View style={st.avatar}>
            <Text style={st.avatarText}>{name[0]}</Text>
          </View>
          <Text style={st.profileName} testID="parent-profile-name">{name}</Text>
          <Text style={st.profilePhone}>{phone}</Text>
        </View>

        {/* KPI Metrics */}
        <View style={st.metricsGrid}>
          <MetricCard icon="people" label="Дітей" value={`${childrenCount}`} color="#3B82F6" />
          <MetricCard icon="card" label="Борг" value={debt > 0 ? `${debt.toLocaleString()} ₴` : '0 ₴'} color={debt > 0 ? '#EF4444' : '#22C55E'} />
          <MetricCard icon="cash" label="Щомісяця" value={totalMonthly > 0 ? `${totalMonthly.toLocaleString()} ₴` : '—'} color={ACCENT} />
          <MetricCard icon="heart" label="LTV" value={totalMonthly > 0 ? `${(totalMonthly * 12 / 1000).toFixed(0)}K ₴` : '—'} color="#EC4899" />
        </View>

        {/* Children with subscriptions */}
        <Section title={`Діти (${children.length})`}>
          {children.map((child: any) => {
            const childName = `${child.firstName || ''} ${child.lastName || ''}`.trim() || child.name || 'Дитина';
            const belt = child.belt || 'WHITE';
            const sub = subscriptions.find((s: any) => s.childId === (child.id || child._id));
            return (
              <TouchableOpacity
                key={child.id || child._id}
                style={st.childCard}
                onPress={() => router.push(`/people/student/${child.id || child._id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[st.childAvatar, { backgroundColor: (BELT_COLORS[belt] || '#E5E7EB') + '40' }]}>
                  <View style={[st.childBeltDot, { backgroundColor: BELT_COLORS[belt] || '#E5E7EB' }]} />
                </View>
                <View style={st.childInfo}>
                  <Text style={st.childName}>{childName}</Text>
                  <Text style={st.childMeta}>
                    {child.group?.name || child.programType || ''}
                  </Text>
                </View>
                <View style={st.childRight}>
                  {sub && (
                    <View style={[st.subBadge, { backgroundColor: sub.status === 'ACTIVE' ? '#22C55E15' : sub.status === 'FROZEN' ? '#3B82F615' : '#EF444415' }]}>
                      <Text style={[st.subBadgeText, { color: sub.status === 'ACTIVE' ? '#22C55E' : sub.status === 'FROZEN' ? '#3B82F6' : '#EF4444' }]}>
                        {sub.status === 'ACTIVE' ? 'Активна' : sub.status === 'FROZEN' ? 'Замор.' : sub.status}
                      </Text>
                    </View>
                  )}
                  {sub && <Text style={st.childPrice}>{sub.price?.toLocaleString()} ₴/міс</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </Section>

        {/* Finance Summary */}
        <Section title="Фінанси">
          <View style={st.financeCard}>
            <View style={st.finRow}>
              <View style={st.finItem}>
                <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                <Text style={st.finLabel}>Місячний</Text>
                <Text style={[st.finValue, { color: '#22C55E' }]}>{totalMonthly > 0 ? `${totalMonthly.toLocaleString()} ₴` : '—'}</Text>
              </View>
              <View style={st.finItem}>
                <Ionicons name="trending-up" size={24} color={ACCENT} />
                <Text style={st.finLabel}>Річний LTV</Text>
                <Text style={[st.finValue, { color: ACCENT }]}>{totalMonthly > 0 ? `${(totalMonthly * 12).toLocaleString()} ₴` : '—'}</Text>
              </View>
              <View style={st.finItem}>
                <Ionicons name="alert-circle" size={24} color="#EF4444" />
                <Text style={st.finLabel}>Борг</Text>
                <Text style={[st.finValue, { color: debt > 0 ? '#EF4444' : '#22C55E' }]}>{debt > 0 ? `${debt.toLocaleString()} ₴` : '0 ₴'}</Text>
              </View>
            </View>
          </View>
        </Section>

        {/* Actions */}
        <Section title="Дії">
          <View style={st.actionsGrid}>
            <ActionBtn icon="chatbubble" label="Написати" color="#3B82F6" onPress={() => setMessageModal(true)} loading={actionLoading === 'message'} />
            <ActionBtn icon="pricetag" label="-15% пропозиція" color="#EF4444" onPress={handleSendOffer} loading={actionLoading === 'offer'} />
            <ActionBtn icon="receipt" label="Рахунки" color="#F59E0B" onPress={() => router.push('/admin/finance/invoices' as any)} />
            <ActionBtn icon="cart" label="Маркетплейс" color={ACCENT} onPress={() => router.push('/marketplace/home' as any)} />
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Message Modal */}
      <Modal visible={messageModal} transparent animationType="slide">
        <Pressable style={st.modalOverlay} onPress={() => setMessageModal(false)}>
          <Pressable style={st.modalContent} onPress={() => {}}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Написати {name}</Text>
              <TouchableOpacity onPress={() => setMessageModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="parent-message-input"
              style={st.messageInput}
              placeholder="Введіть повідомлення..."
              placeholderTextColor="#9CA3AF"
              value={messageText}
              onChangeText={setMessageText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              testID="parent-send-message-btn"
              style={[st.sendBtn, !messageText.trim() && st.sendBtnDisabled]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || actionLoading === 'message'}
            >
              {actionLoading === 'message' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={st.sendBtnText}>Відправити</Text>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={st.metricCard}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[st.metricValue, { color }]}>{value}</Text>
      <Text style={st.metricLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActionBtn({ icon, label, color, onPress, loading }: { icon: string; label: string; color: string; onPress?: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity style={[st.actionBtn, { borderColor: color + '30' }]} activeOpacity={0.7} onPress={onPress} disabled={loading}>
      <View style={[st.actionIcon, { backgroundColor: color + '15' }]}>
        {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon as any} size={18} color={color} />}
      </View>
      <Text style={[st.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  errText: { fontSize: 16, color: '#6B7280' },
  retryBtn: { backgroundColor: ACCENT, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  retryBtnText: { color: '#fff', fontWeight: '600' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  toast: { position: 'absolute', top: 60, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, zIndex: 999 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  profileHeader: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff' },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EC489920', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#EC4899' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#0F0F10', marginTop: 12 },
  profilePhone: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  metricCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 10 },
  childCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, gap: 12 },
  childAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  childBeltDot: { width: 14, height: 14, borderRadius: 7 },
  childInfo: { flex: 1 },
  childName: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  childMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  childRight: { alignItems: 'flex-end', gap: 4 },
  subBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  subBadgeText: { fontSize: 10, fontWeight: '700' },
  childPrice: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  financeCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finItem: { alignItems: 'center', gap: 6 },
  finLabel: { fontSize: 11, color: '#9CA3AF' },
  finValue: { fontSize: 16, fontWeight: '700' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, gap: 8 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  messageInput: { backgroundColor: '#F5F5F7', borderRadius: 12, padding: 16, fontSize: 15, color: '#0F0F10', minHeight: 100, marginBottom: 16 },
  sendBtn: { backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
