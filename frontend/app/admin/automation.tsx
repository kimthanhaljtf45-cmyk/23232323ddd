import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { api } from '@/lib/api';

const ACCENT = '#7C3AED';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  condition: { field: string; operator: string; value: any };
  actions: string[];
  isActive: boolean;
  priority: number;
  icon: string;
  color: string;
  executionCount: number;
  lastExecuted: string | null;
}

interface AutomationLog {
  ruleId: string;
  ruleName: string;
  targetId: string;
  targetName: string;
  action: string;
  result: string;
  computedValue: number;
  createdAt: string;
}

interface AutomationStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  todayActions: number;
}

function Toast({ visible, message, type }: { visible: boolean; message: string; type: 'success' | 'error' }) {
  if (!visible) return null;
  return (
    <View style={[st.toast, { backgroundColor: type === 'success' ? '#22C55E' : '#EF4444' }]}>
      <Ionicons name={type === 'success' ? 'checkmark-circle' : 'alert-circle'} size={20} color="#fff" />
      <Text style={st.toastText}>{message}</Text>
    </View>
  );
}

const ACTION_LABELS: Record<string, string> = {
  discount_20: 'Знижка -20%',
  message_parent: 'Повідомлення батькам',
  recommend_product: 'Рекомендація товару',
  assign_coach: 'Призначити тренера',
  alert_admin: 'Алерт адміну',
};

export default function AutomationScreen() {
  const router = useRouter();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState<AutomationStats>({ totalRules: 0, activeRules: 0, totalExecutions: 0, todayActions: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeView, setActiveView] = useState<'rules' | 'logs'>('rules');
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as const });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ visible: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, logsRes, statsRes] = await Promise.all([
        api.get('/automation/rules').catch(() => []),
        api.get('/automation/logs?limit=30').catch(() => []),
        api.get('/automation/stats').catch(() => ({ totalRules: 0, activeRules: 0, totalExecutions: 0, todayActions: 0 })),
      ]);
      setRules(rulesRes || []);
      setLogs(logsRes || []);
      setStats(statsRes || { totalRules: 0, activeRules: 0, totalExecutions: 0, todayActions: 0 });
    } catch (e) {
      console.error('Automation fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const toggleRule = async (ruleId: string, newValue: boolean) => {
    try {
      await api.patch(`/automation/rules/${ruleId}`, { isActive: newValue });
      setRules(prev => prev.map(r => r.id === ruleId ? { ...r, isActive: newValue } : r));
      setStats(prev => ({
        ...prev,
        activeRules: prev.activeRules + (newValue ? 1 : -1),
      }));
      showToast(newValue ? 'Правило активовано' : 'Правило вимкнено');
    } catch (e) {
      showToast('Помилка', 'error');
    }
  };

  const runAutomation = async () => {
    setRunning(true);
    try {
      await api.post('/automation/run', {});
      await fetchData();
      showToast('Автоматизацію запущено!');
    } catch (e) {
      showToast('Помилка запуску', 'error');
    } finally {
      setRunning(false);
    }
  };

  const confirmRun = () => {
    Alert.alert(
      'Запустити автоматизацію',
      'Це застосує всі активні правила до учнів прямо зараз.',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Запустити', style: 'destructive', onPress: runAutomation },
      ]
    );
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return 'Ніколи';
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'discount_20': return 'pricetag';
      case 'message_parent': return 'chatbubble';
      case 'recommend_product': return 'cart';
      case 'assign_coach': return 'person-add';
      case 'alert_admin': return 'notifications';
      default: return 'flash';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={st.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.center}><ActivityIndicator size="large" color={ACCENT} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <Toast visible={toast.visible} message={toast.message} type={toast.type} />

      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={st.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Automation Center</Text>
        <TouchableOpacity
          testID="run-automation-btn"
          onPress={confirmRun}
          style={st.runBtn}
          disabled={running}
        >
          {running ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="play" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Dashboard */}
        <View style={st.statsGrid}>
          <View style={st.statCard}>
            <Ionicons name="flash" size={22} color={ACCENT} />
            <Text style={st.statValue}>{stats.activeRules}</Text>
            <Text style={st.statLabel}>Активних</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="pulse" size={22} color="#22C55E" />
            <Text style={[st.statValue, { color: '#22C55E' }]}>{stats.todayActions}</Text>
            <Text style={st.statLabel}>Дій сьогодні</Text>
          </View>
          <View style={st.statCard}>
            <Ionicons name="analytics" size={22} color="#F59E0B" />
            <Text style={[st.statValue, { color: '#F59E0B' }]}>{stats.totalExecutions}</Text>
            <Text style={st.statLabel}>Всього дій</Text>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={st.tabRow}>
          <TouchableOpacity
            style={[st.tab, activeView === 'rules' && st.tabActive]}
            onPress={() => setActiveView('rules')}
          >
            <Text style={[st.tabText, activeView === 'rules' && st.tabTextActive]}>Правила</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.tab, activeView === 'logs' && st.tabActive]}
            onPress={() => setActiveView('logs')}
          >
            <Text style={[st.tabText, activeView === 'logs' && st.tabTextActive]}>Журнал дій</Text>
            {stats.todayActions > 0 && (
              <View style={st.tabBadge}>
                <Text style={st.tabBadgeText}>{stats.todayActions}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Rules */}
        {activeView === 'rules' && rules.map((rule) => (
          <View key={rule.id} style={st.ruleCard} testID={`rule-card-${rule.id}`}>
            <View style={st.ruleHeader}>
              <View style={[st.ruleIcon, { backgroundColor: (rule.color || ACCENT) + '15' }]}>
                <Ionicons name={(rule.icon || 'flash') as any} size={20} color={rule.color || ACCENT} />
              </View>
              <View style={st.ruleInfo}>
                <Text style={st.ruleName}>{rule.name}</Text>
                <Text style={st.ruleDesc}>{rule.description}</Text>
              </View>
              <Switch
                testID={`rule-toggle-${rule.id}`}
                value={rule.isActive}
                onValueChange={(v) => toggleRule(rule.id, v)}
                trackColor={{ false: '#E5E7EB', true: ACCENT + '60' }}
                thumbColor={rule.isActive ? ACCENT : '#9CA3AF'}
              />
            </View>
            <View style={st.ruleMetrics}>
              <View style={st.ruleMetric}>
                <Ionicons name="flash" size={14} color="#6B7280" />
                <Text style={st.ruleMetricText}>
                  {rule.executionCount || 0} виконань
                </Text>
              </View>
              <View style={st.ruleMetric}>
                <Ionicons name="time" size={14} color="#6B7280" />
                <Text style={st.ruleMetricText}>
                  {formatTime(rule.lastExecuted)}
                </Text>
              </View>
              <View style={st.ruleTags}>
                {rule.actions.map((a) => (
                  <View key={a} style={[st.actionTag, { backgroundColor: (rule.color || ACCENT) + '10' }]}>
                    <Ionicons name={getActionIcon(a) as any} size={10} color={rule.color || ACCENT} />
                    <Text style={[st.actionTagText, { color: rule.color || ACCENT }]}>{ACTION_LABELS[a] || a}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ))}

        {/* Logs */}
        {activeView === 'logs' && (
          <>
            {logs.length === 0 ? (
              <View style={st.emptyState}>
                <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
                <Text style={st.emptyText}>Журнал порожній</Text>
                <Text style={st.emptySubtext}>Запустіть автоматизацію для генерації дій</Text>
              </View>
            ) : (
              logs.map((log, i) => (
                <TouchableOpacity
                  key={i}
                  style={st.logCard}
                  onPress={() => router.push(`/people/student/${log.targetId}` as any)}
                  activeOpacity={0.7}
                >
                  <View style={[st.logDot, { backgroundColor: log.result.startsWith('discount') ? '#22C55E' : log.result.startsWith('message') ? '#3B82F6' : '#6B7280' }]} />
                  <View style={st.logBody}>
                    <Text style={st.logTitle}>{log.targetName}</Text>
                    <Text style={st.logAction}>
                      {ACTION_LABELS[log.action] || log.action}
                      {log.computedValue !== undefined && ` (${log.computedValue.toFixed(0)}%)`}
                    </Text>
                    <Text style={st.logResult}>{log.result}</Text>
                  </View>
                  <Text style={st.logTime}>{formatTime(log.createdAt)}</Text>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  toast: { position: 'absolute', top: 60, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, zIndex: 999 },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  runBtn: { backgroundColor: ACCENT, width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  // Stats
  statsGrid: { flexDirection: 'row', padding: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontWeight: '900', color: ACCENT },
  statLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  // Tabs
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  tabActive: { backgroundColor: ACCENT },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  tabTextActive: { color: '#fff' },
  tabBadge: { backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  // Rule Card
  ruleCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 10 },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ruleIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  ruleInfo: { flex: 1 },
  ruleName: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  ruleDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  ruleMetrics: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  ruleMetric: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleMetricText: { fontSize: 11, color: '#6B7280' },
  ruleTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 'auto' },
  actionTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  actionTagText: { fontSize: 9, fontWeight: '600' },
  // Log Card
  logCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, marginHorizontal: 16, marginBottom: 6, gap: 10 },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logBody: { flex: 1 },
  logTitle: { fontSize: 13, fontWeight: '700', color: '#0F0F10' },
  logAction: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  logResult: { fontSize: 10, color: '#9CA3AF', marginTop: 1 },
  logTime: { fontSize: 11, color: '#9CA3AF' },
  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  emptySubtext: { fontSize: 13, color: '#D1D5DB', textAlign: 'center' },
});
