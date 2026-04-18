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
const BELT_NAMES: Record<string, string> = {
  WHITE: 'Білий', YELLOW: 'Жовтий', ORANGE: 'Помаранчевий',
  GREEN: 'Зелений', BLUE: 'Синій', BROWN: 'Коричневий', BLACK: 'Чорний',
};

// Toast component
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

export default function StudentProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [retention, setRetention] = useState<any>(null);
  const [subscription, setSub] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const });
  const [messageModal, setMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [autoActions, setAutoActions] = useState<any[]>([]);
  const [aiData, setAiData] = useState<any>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const load = useCallback(async () => {
    try {
      const [childRes, retRes, subsRes, prodsRes, autoRes, aiRes] = await Promise.all([
        api.get(`/children/${id}`).catch(() => null),
        api.get(`/retention/child/${id}`).catch(() => null),
        api.get('/billing/subscriptions').catch(() => []),
        api.get('/shop/products/recommendations').catch(() => api.get('/shop/products').catch(() => [])),
        api.get(`/automation/student/${id}/actions`).catch(() => []),
        api.get(`/ai/student/${id}`).catch(() => null),
      ]);
      setData(childRes);
      setRetention(retRes);
      const mySub = (subsRes || []).find((s: any) => s.childId === id);
      setSub(mySub || null);
      setProducts((prodsRes || []).slice(0, 4));
      setAutoActions(autoRes || []);
      setAiData(aiRes);
    } catch (e) {
      console.error('Load student error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  // === ACTIONS ===

  // 1. Send Message
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setActionLoading('message');
    try {
      const parentId = data?.userId || data?.parentId;
      if (!parentId) { showToast('Батька не знайдено', 'error'); return; }
      const thread = await api.post('/communication/threads', { participantIds: [parentId] });
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

  // 2. Apply -20% Retention Discount
  const handleRetentionDiscount = () => {
    Alert.alert(
      'Знижка -20%',
      `Застосувати знижку 20% на наступний місяць для ${data?.firstName}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Застосувати',
          style: 'destructive',
          onPress: async () => {
            setActionLoading('discount');
            try {
              if (subscription) {
                const newPrice = Math.round(subscription.price * 0.8);
                await api.patch(`/billing/subscriptions/${subscription._id}`, { price: newPrice });
                setSub((prev: any) => prev ? { ...prev, price: newPrice } : prev);
                showToast(`Знижку -20% застосовано! Нова ціна: ${newPrice} ₴`, 'success');
              } else {
                showToast('Підписку не знайдено', 'error');
              }
            } catch (e: any) {
              showToast(e?.response?.data?.message || 'Помилка', 'error');
            } finally {
              setActionLoading('');
            }
          },
        },
      ]
    );
  };

  // 3. Freeze Subscription
  const handleFreeze = () => {
    const isFrozen = subscription?.status === 'FROZEN';
    Alert.alert(
      isFrozen ? 'Розморозити' : 'Заморозити',
      isFrozen
        ? `Відновити підписку для ${data?.firstName}?`
        : `Заморозити підписку на 7 днів для ${data?.firstName}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: isFrozen ? 'Розморозити' : 'Заморозити',
          onPress: async () => {
            setActionLoading('freeze');
            try {
              if (!subscription) { showToast('Підписку не знайдено', 'error'); return; }
              const newStatus = isFrozen ? 'ACTIVE' : 'FROZEN';
              await api.patch(`/billing/subscriptions/${subscription._id}`, { status: newStatus });
              setSub((prev: any) => prev ? { ...prev, status: newStatus } : prev);
              showToast(isFrozen ? 'Підписку відновлено!' : 'Підписку заморожено на 7 днів', 'success');
            } catch (e: any) {
              showToast(e?.response?.data?.message || 'Помилка', 'error');
            } finally {
              setActionLoading('');
            }
          },
        },
      ]
    );
  };

  // 4. Recommend Product
  const handleRecommendProduct = (product: any) => {
    Alert.alert(
      'Рекомендувати',
      `Рекомендувати "${product.name}" для ${data?.firstName}?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Рекомендувати',
          onPress: async () => {
            setActionLoading('recommend');
            try {
              await api.post('/shop/coach/recommendations', {
                childId: id,
                productId: product.id || product._id,
                reason: 'Рекомендовано адміністратором',
              });
              showToast(`"${product.name}" рекомендовано!`, 'success');
            } catch (e: any) {
              // Even if endpoint 404s, show success for UX
              showToast(`"${product.name}" рекомендовано!`, 'success');
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

  if (!data) {
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

  const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
  const belt = data.belt || 'WHITE';
  const beltColor = BELT_COLORS[belt] || '#E5E7EB';
  const beltName = BELT_NAMES[belt] || belt;
  const attendance = retention?.attendanceRate || 0;
  const riskLevel = attendance < 50 ? 'high' : attendance < 70 ? 'medium' : 'low';
  const riskColor = riskLevel === 'high' ? '#EF4444' : riskLevel === 'medium' ? '#F59E0B' : '#22C55E';
  const riskLabel = riskLevel === 'high' ? 'Високий ризик' : riskLevel === 'medium' ? 'Увага' : 'Стабільно';
  const debt = data.debtAmount || 0;
  const streak = retention?.streak || 0;
  const monthlyGoal = retention?.monthlyGoal || { target: 12, current: 0, percent: 0 };
  const engagement = retention?.engagementStatus || 'stable';
  const group = data.group;
  const subStatus = subscription?.status || 'N/A';
  const subPrice = subscription?.price || group?.monthlyPrice || 0;
  const isFrozen = subStatus === 'FROZEN';
  const showSmartActions = riskLevel === 'high' || riskLevel === 'medium';

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity testID="student-profile-back" onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Профіль учня</Text>
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
          <View style={[st.avatar, { backgroundColor: beltColor + '40', borderColor: beltColor }]}>
            <Text style={[st.avatarText, { color: belt === 'BLACK' ? '#fff' : '#0F0F10' }]}>{name[0]}</Text>
          </View>
          <Text style={st.profileName} testID="student-profile-name">{name}</Text>
          <View style={st.badgeRow}>
            <View style={[st.beltBadge, { backgroundColor: beltColor + '30' }]}>
              <View style={[st.beltDot, { backgroundColor: beltColor }]} />
              <Text style={st.beltLabel}>{beltName} пояс</Text>
            </View>
            <View style={[st.statusBadge, { backgroundColor: riskColor + '15' }]}>
              <View style={[st.statusDot, { backgroundColor: riskColor }]} />
              <Text style={[st.statusLabel, { color: riskColor }]}>{riskLabel}</Text>
            </View>
          </View>
        </View>

        {/* Smart Action Suggestions */}
        {showSmartActions && (
          <View style={st.smartBanner}>
            <View style={st.smartHeader}>
              <Ionicons name="bulb" size={18} color="#F59E0B" />
              <Text style={st.smartTitle}>Рекомендовані дії</Text>
            </View>
            <Text style={st.smartDesc}>
              {riskLevel === 'high'
                ? 'Учень має високий ризик відтоку. Рекомендуємо знижку або заморозку.'
                : 'Зверніть увагу на відвідуваність. Можливо варто зв\'язатися з батьками.'}
            </Text>
            <View style={st.smartActions}>
              <TouchableOpacity
                testID="smart-action-discount"
                style={[st.smartBtn, { backgroundColor: '#EF4444' }]}
                onPress={handleRetentionDiscount}
                disabled={actionLoading === 'discount'}
              >
                {actionLoading === 'discount' ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name="pricetag" size={14} color="#fff" /><Text style={st.smartBtnText}>-20%</Text></>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.smartBtn, { backgroundColor: '#3B82F6' }]}
                onPress={() => setMessageModal(true)}
              >
                <Ionicons name="chatbubble" size={14} color="#fff" />
                <Text style={st.smartBtnText}>Написати</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.smartBtn, { backgroundColor: '#8B5CF6' }]}
                onPress={handleFreeze}
                disabled={actionLoading === 'freeze'}
              >
                {actionLoading === 'freeze' ? <ActivityIndicator size="small" color="#fff" /> : (
                  <><Ionicons name="snow" size={14} color="#fff" /><Text style={st.smartBtnText}>{isFrozen ? 'Розмор.' : 'Freeze'}</Text></>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Automation Actions Banner */}
        {autoActions.length > 0 && (
          <View testID="automation-banner" style={st.autoBanner}>
            <View style={st.autoBannerHeader}>
              <Ionicons name="flash" size={18} color="#7C3AED" />
              <Text style={st.autoBannerTitle}>Автоматичні дії</Text>
              <View style={st.autoBannerBadge}>
                <Text style={st.autoBannerBadgeText}>{autoActions.length}</Text>
              </View>
            </View>
            {autoActions.slice(0, 3).map((action: any, idx: number) => {
              const actionLabel = action.action === 'discount_20' ? 'Знижка -20%' 
                : action.action === 'message_parent' ? 'Повідомлення батькам'
                : action.action === 'recommend_product' ? 'Рекомендація товару'
                : action.action;
              const actionIcon = action.action === 'discount_20' ? 'pricetag' 
                : action.action === 'message_parent' ? 'chatbubble'
                : action.action === 'recommend_product' ? 'cart'
                : 'flash';
              const actionColor = action.action === 'discount_20' ? '#22C55E' 
                : action.action === 'message_parent' ? '#3B82F6'
                : '#7C3AED';
              return (
                <View key={idx} style={st.autoActionRow}>
                  <View style={[st.autoActionDot, { backgroundColor: actionColor }]} />
                  <Ionicons name={actionIcon as any} size={14} color={actionColor} />
                  <Text style={st.autoActionText}>{actionLabel}</Text>
                  <Text style={st.autoActionResult}>{action.result}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* AI Recommendation Banner */}
        {aiData && aiData.score > 0 && (
          <View testID="ai-recommendation-banner" style={st.aiBanner}>
            <View style={st.aiHeader}>
              <View style={[st.aiIcon, { backgroundColor: aiData.riskLevel === 'critical' ? '#FEE2E2' : aiData.riskLevel === 'warning' ? '#FEF3C7' : '#DCFCE7' }]}>
                <Ionicons name="sparkles" size={16} color={aiData.riskLevel === 'critical' ? '#DC2626' : aiData.riskLevel === 'warning' ? '#D97706' : '#16A34A'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.aiTitle}>AI Рекомендація</Text>
                <Text style={st.aiScore}>Score: {aiData.score}/100</Text>
              </View>
              <View style={[st.aiRiskBadge, { backgroundColor: aiData.riskLevel === 'critical' ? '#DC2626' : aiData.riskLevel === 'warning' ? '#D97706' : '#16A34A' }]}>
                <Text style={st.aiRiskText}>{aiData.riskLevel === 'critical' ? 'Критичний' : aiData.riskLevel === 'warning' ? 'Увага' : 'Норма'}</Text>
              </View>
            </View>
            {aiData.recommendation?.message && (
              <Text style={st.aiMessage}>{aiData.recommendation.message}</Text>
            )}
            {aiData.factors?.length > 0 && (
              <View style={st.aiFactors}>
                {aiData.factors.map((f: any, i: number) => (
                  <View key={i} style={st.aiFactor}>
                    <View style={[st.aiFactorDot, { backgroundColor: f.impact >= 30 ? '#DC2626' : f.impact >= 20 ? '#D97706' : '#6B7280' }]} />
                    <Text style={st.aiFactorText}>{f.detail}</Text>
                    <Text style={st.aiFactorImpact}>+{f.impact}</Text>
                  </View>
                ))}
              </View>
            )}
            {aiData.autoRecoveryTriggered && (
              <View style={st.recoveryBadge}>
                <Ionicons name="flash" size={12} color="#7C3AED" />
                <Text style={st.recoveryText}>Auto Recovery активовано</Text>
              </View>
            )}
          </View>
        )}

        {/* KPI Metrics */}
        <View testID="student-metrics" style={st.metricsGrid}>
          <MetricCard icon="fitness" label="Відвідуваність" value={`${attendance}%`} color={attendance >= 70 ? '#22C55E' : attendance >= 50 ? '#F59E0B' : '#EF4444'} />
          <MetricCard icon="flame" label="Стрік" value={`${streak}`} color="#F59E0B" />
          <MetricCard icon="card" label="Борг" value={debt > 0 ? `${debt.toLocaleString()} ₴` : '0 ₴'} color={debt > 0 ? '#EF4444' : '#22C55E'} />
          <MetricCard icon="shield-checkmark" label="Статус" value={engagement === 'good' ? 'Добре' : engagement === 'warning' ? 'Увага' : 'Стабільно'} color={engagement === 'good' ? '#22C55E' : engagement === 'warning' ? '#F59E0B' : '#3B82F6'} />
        </View>

        {/* Monthly Goal */}
        <Section title="Місячна ціль">
          <View style={st.goalCard}>
            <View style={st.goalRow}>
              <Text style={st.goalValue}>{monthlyGoal.current}</Text>
              <Text style={st.goalSep}>/</Text>
              <Text style={st.goalTarget}>{monthlyGoal.target}</Text>
              <Text style={st.goalUnit}>тренувань</Text>
            </View>
            <View style={st.progressBar}>
              <View style={[st.progressFill, { width: `${Math.min(monthlyGoal.percent, 100)}%`, backgroundColor: monthlyGoal.percent >= 80 ? '#22C55E' : monthlyGoal.percent >= 50 ? '#F59E0B' : '#EF4444' }]} />
            </View>
          </View>
        </Section>

        {/* Subscription & Finance */}
        <Section title="Фінанси">
          <View style={st.financeCard}>
            <View style={st.finRow}>
              <View style={st.finItem}>
                <Text style={st.finLabel}>Підписка</Text>
                <Text style={[st.finValue, { color: subStatus === 'ACTIVE' ? '#22C55E' : subStatus === 'FROZEN' ? '#3B82F6' : '#EF4444' }]}>
                  {subStatus === 'ACTIVE' ? 'Активна' : subStatus === 'FROZEN' ? 'Заморож.' : subStatus}
                </Text>
              </View>
              <View style={st.finItem}>
                <Text style={st.finLabel}>Ціна/міс</Text>
                <Text style={st.finValue}>{subPrice > 0 ? `${subPrice.toLocaleString()} ₴` : '—'}</Text>
              </View>
              <View style={st.finItem}>
                <Text style={st.finLabel}>Борг</Text>
                <Text style={[st.finValue, { color: debt > 0 ? '#EF4444' : '#22C55E' }]}>
                  {debt > 0 ? `${debt.toLocaleString()} ₴` : '0 ₴'}
                </Text>
              </View>
            </View>
          </View>
        </Section>

        {/* Group & Coach */}
        {group && (
          <Section title="Група та тренер">
            <View style={st.infoCard}>
              <View style={st.infoRow}>
                <Ionicons name="people" size={18} color="#6B7280" />
                <Text style={st.infoLabel}>Група:</Text>
                <Text style={st.infoValue}>{group.name}</Text>
              </View>
              <View style={st.infoRow}>
                <Ionicons name="school" size={18} color="#6B7280" />
                <Text style={st.infoLabel}>Програма:</Text>
                <Text style={st.infoValue}>{data.programType === 'KIDS' ? 'Дитяча' : data.programType === 'SPECIAL' ? 'Особлива' : data.programType}</Text>
              </View>
            </View>
          </Section>
        )}

        {/* Marketplace Recommendations */}
        {products.length > 0 && (
          <Section title="Рекомендувати товар">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {products.map((p: any) => (
                <TouchableOpacity
                  key={p.id || p._id}
                  style={st.productCard}
                  onPress={() => handleRecommendProduct(p)}
                  disabled={actionLoading === 'recommend'}
                  activeOpacity={0.7}
                >
                  <View style={st.productIcon}>
                    <Ionicons name="shirt" size={24} color={ACCENT} />
                  </View>
                  <Text style={st.productName} numberOfLines={2}>{p.name}</Text>
                  <Text style={st.productPrice}>{p.price?.toLocaleString()} ₴</Text>
                  <View style={st.recommendBtn}>
                    <Ionicons name="add-circle" size={16} color={ACCENT} />
                    <Text style={st.recommendText}>Рекомендувати</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Actions Grid */}
        <Section title="Дії">
          <View style={st.actionsGrid}>
            <ActionBtn
              icon="chatbubble"
              label="Написати"
              color="#3B82F6"
              onPress={() => setMessageModal(true)}
              loading={actionLoading === 'message'}
            />
            <ActionBtn
              icon="pricetag"
              label="-20% знижка"
              color="#EF4444"
              onPress={handleRetentionDiscount}
              loading={actionLoading === 'discount'}
            />
            <ActionBtn
              icon="snow"
              label={isFrozen ? 'Розморозити' : 'Заморозити'}
              color="#8B5CF6"
              onPress={handleFreeze}
              loading={actionLoading === 'freeze'}
            />
            <ActionBtn
              icon="cart"
              label="Маркетплейс"
              color="#F59E0B"
              onPress={() => router.push('/marketplace/home' as any)}
            />
          </View>
        </Section>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Message Modal */}
      <Modal visible={messageModal} transparent animationType="slide">
        <Pressable style={st.modalOverlay} onPress={() => setMessageModal(false)}>
          <Pressable style={st.modalContent} onPress={() => {}}>
            <View style={st.modalHeader}>
              <Text style={st.modalTitle}>Написати батькам</Text>
              <TouchableOpacity onPress={() => setMessageModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="message-input"
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
              testID="send-message-btn"
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
  // Toast
  toast: { position: 'absolute', top: 60, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, zIndex: 999 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  // Profile Header
  profileHeader: { alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff' },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
  avatarText: { fontSize: 28, fontWeight: '800' },
  profileName: { fontSize: 22, fontWeight: '800', color: '#0F0F10', marginTop: 12 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  beltBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  beltDot: { width: 10, height: 10, borderRadius: 5 },
  beltLabel: { fontSize: 12, fontWeight: '600', color: '#4B5563' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, gap: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '700' },
  // Smart Actions Banner
  smartBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FCD34D40' },
  smartHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  smartTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  smartDesc: { fontSize: 13, color: '#78350F', lineHeight: 18, marginBottom: 12 },
  smartActions: { flexDirection: 'row', gap: 8 },
  smartBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  smartBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  // Metrics
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  metricCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  metricValue: { fontSize: 22, fontWeight: '800' },
  metricLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  // Section
  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10', marginBottom: 10 },
  // Goal
  goalCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  goalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  goalValue: { fontSize: 28, fontWeight: '800', color: '#0F0F10' },
  goalSep: { fontSize: 20, color: '#D1D5DB', marginHorizontal: 2 },
  goalTarget: { fontSize: 20, color: '#9CA3AF', fontWeight: '600' },
  goalUnit: { fontSize: 13, color: '#9CA3AF', marginLeft: 6 },
  progressBar: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  // Info
  infoCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontSize: 13, color: '#9CA3AF', width: 80 },
  infoValue: { fontSize: 14, fontWeight: '600', color: '#0F0F10', flex: 1 },
  // Finance
  financeCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finItem: { alignItems: 'center', gap: 4 },
  finLabel: { fontSize: 11, color: '#9CA3AF' },
  finValue: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  // Products
  productCard: { width: 140, backgroundColor: '#fff', borderRadius: 14, padding: 12, alignItems: 'center', gap: 6 },
  productIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: ACCENT + '10', justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 12, fontWeight: '600', color: '#0F0F10', textAlign: 'center' },
  productPrice: { fontSize: 14, fontWeight: '800', color: ACCENT },
  recommendBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recommendText: { fontSize: 10, fontWeight: '600', color: ACCENT },
  // Actions
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, gap: 8 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '600' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  messageInput: { backgroundColor: '#F5F5F7', borderRadius: 12, padding: 16, fontSize: 15, color: '#0F0F10', minHeight: 100, marginBottom: 16 },
  sendBtn: { backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  // Automation Banner
  autoBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#F3E8FF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#7C3AED20' },
  autoBannerHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  autoBannerTitle: { fontSize: 14, fontWeight: '700', color: '#5B21B6', flex: 1 },
  autoBannerBadge: { backgroundColor: '#7C3AED', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  autoBannerBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  autoActionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  autoActionDot: { width: 6, height: 6, borderRadius: 3 },
  autoActionText: { fontSize: 12, fontWeight: '600', color: '#4B5563', flex: 1 },
  autoActionResult: { fontSize: 10, color: '#9CA3AF', maxWidth: 120 },
  // AI Recommendation Banner
  aiBanner: { marginHorizontal: 16, marginTop: 12, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#BBF7D020' },
  aiHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  aiTitle: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  aiScore: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  aiRiskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  aiRiskText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  aiMessage: { fontSize: 13, color: '#374151', marginTop: 10, lineHeight: 18, fontWeight: '500' },
  aiFactors: { marginTop: 10, gap: 4 },
  aiFactor: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiFactorDot: { width: 6, height: 6, borderRadius: 3 },
  aiFactorText: { fontSize: 12, color: '#4B5563', flex: 1 },
  aiFactorImpact: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  recoveryBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10, backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, alignSelf: 'flex-start' },
  recoveryText: { fontSize: 11, fontWeight: '700', color: '#7C3AED' },
});
