import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

const riskColor = (score: number) => score >= 60 ? '#EF4444' : score >= 30 ? '#F59E0B' : '#22C55E';
const riskIcon = (score: number) => score >= 60 ? 'flame' : score >= 30 ? 'warning' : 'shield-checkmark';

export default function RetentionDashboardScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['retention-dashboard'],
    queryFn: () => api.get('/retention/admin/dashboard'),
  });

  const actionMutation = useMutation({
    mutationFn: (body: { childId: string; action: string }) => api.post('/retention/admin/action', body),
    onSuccess: (res: any) => {
      Alert.alert('Дію застосовано', res.appliedActions?.join('\n') || 'OK');
      queryClient.invalidateQueries({ queryKey: ['retention-dashboard'] });
    },
  });

  const handleAction = (childId: string, name: string, action: string, label: string) => {
    Alert.alert(label, `${name}`, [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Підтвердити', onPress: () => actionMutation.mutate({ childId, action }) },
    ]);
  };

  const summary = data?.summary || {};
  const critical = data?.critical || [];
  const warning = data?.warning || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Retention</Text>
        <TouchableOpacity testID="recalc-btn" onPress={() => refetch()} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { borderLeftColor: '#EF4444' }]}>
            <Text style={styles.summaryNum}>{summary.totalAtRisk || 0}</Text>
            <Text style={styles.summaryLabel}>Ризик</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.summaryNum}>{summary.potentialLoss || 0}₴</Text>
            <Text style={styles.summaryLabel}>Втрати</Text>
          </View>
          <View style={[styles.summaryCard, { borderLeftColor: '#22C55E' }]}>
            <Text style={styles.summaryNum}>{summary.retentionRate || 0}%</Text>
            <Text style={styles.summaryLabel}>Retention</Text>
          </View>
        </View>

        {/* Critical Section */}
        {critical.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={16} color="#EF4444" />
              <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>Критично ({critical.length})</Text>
            </View>
            {critical.map((item: any) => (
              <StudentRiskCard key={item.childId} item={item} onAction={handleAction} />
            ))}
          </>
        )}

        {/* Warning Section */}
        {warning.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="warning" size={16} color="#F59E0B" />
              <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>Увага ({warning.length})</Text>
            </View>
            {warning.map((item: any) => (
              <StudentRiskCard key={item.childId} item={item} onAction={handleAction} />
            ))}
          </>
        )}

        {/* Healthy */}
        {(data?.healthy || 0) > 0 && (
          <View style={styles.healthyBanner}>
            <Ionicons name="shield-checkmark" size={18} color="#22C55E" />
            <Text style={styles.healthyText}>{data.healthy} учнів у нормі</Text>
          </View>
        )}

        {critical.length === 0 && warning.length === 0 && !isLoading && (
          <View style={styles.empty}>
            <Ionicons name="shield-checkmark" size={48} color="#22C55E" />
            <Text style={styles.emptyTitle}>Все добре!</Text>
            <Text style={styles.emptyText}>Жоден учень не в зоні ризику</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StudentRiskCard({ item, onAction }: { item: any; onAction: (id: string, name: string, action: string, label: string) => void }) {
  const color = riskColor(item.riskScore);

  return (
    <View style={styles.card} testID={`risk-card-${item.childId}`}>
      {/* Row 1: Name + Risk Score */}
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <View style={styles.cardMeta}>
            {item.daysSinceLastVisit > 0 && (
              <Text style={styles.metaText}>{item.daysSinceLastVisit}д без візиту</Text>
            )}
            {item.attendanceRate > 0 && (
              <Text style={styles.metaText}>{item.attendanceRate}% відвідуваність</Text>
            )}
          </View>
        </View>
        <View style={[styles.riskBadge, { backgroundColor: color + '15' }]}>
          <Ionicons name={riskIcon(item.riskScore) as any} size={14} color={color} />
          <Text style={[styles.riskText, { color }]}>{item.riskScore}%</Text>
        </View>
      </View>

      {/* Row 2: Debt + Streak */}
      {(item.debt > 0 || item.streak > 0) && (
        <View style={styles.cardStats}>
          {item.debt > 0 && (
            <View style={styles.statChip}>
              <Ionicons name="card" size={12} color="#EF4444" />
              <Text style={[styles.statText, { color: '#EF4444' }]}>Борг: {item.debt}₴</Text>
            </View>
          )}
          {item.streak > 0 && (
            <View style={styles.statChip}>
              <Ionicons name="flame" size={12} color="#F59E0B" />
              <Text style={styles.statText}>Серія: {item.streak}</Text>
            </View>
          )}
        </View>
      )}

      {/* Row 3: Quick Actions */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          testID={`discount-${item.childId}`}
          style={[styles.actionChip, { backgroundColor: '#FEF3C7' }]}
          onPress={() => onAction(item.childId, item.name, 'DISCOUNT_20', 'Знижка -20%')}
        >
          <Text style={[styles.actionText, { color: '#B45309' }]}>-20%</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`freeze-${item.childId}`}
          style={[styles.actionChip, { backgroundColor: '#DBEAFE' }]}
          onPress={() => onAction(item.childId, item.name, 'FREEZE_7', 'Заморозка 7 днів')}
        >
          <Ionicons name="snow" size={12} color="#2563EB" />
          <Text style={[styles.actionText, { color: '#2563EB' }]}>7д</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID={`message-${item.childId}`}
          style={[styles.actionChip, { backgroundColor: '#F3E8FF' }]}
          onPress={() => onAction(item.childId, item.name, 'MESSAGE', 'Надіслати повідомлення')}
        >
          <Ionicons name="chatbubble" size={12} color="#7C3AED" />
        </TouchableOpacity>
        <TouchableOpacity
          testID={`call-${item.childId}`}
          style={[styles.actionChip, { backgroundColor: '#DCFCE7' }]}
          onPress={() => onAction(item.childId, item.name, 'CALL', 'Зателефонувати')}
        >
          <Ionicons name="call" size={12} color="#16A34A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 36, height: 36, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  refreshBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 12 },

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderLeftWidth: 3 },
  summaryNum: { fontSize: 18, fontWeight: '800', color: '#111' },
  summaryLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Section
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },

  // Card
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, gap: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInfo: { flex: 1, marginRight: 8 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#111' },
  cardMeta: { flexDirection: 'row', gap: 8, marginTop: 2 },
  metaText: { fontSize: 11, color: '#9CA3AF' },

  riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  riskText: { fontSize: 13, fontWeight: '800' },

  cardStats: { flexDirection: 'row', gap: 8 },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F9FAFB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statText: { fontSize: 11, fontWeight: '500', color: '#6B7280' },

  cardActions: { flexDirection: 'row', gap: 6, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  actionChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  actionText: { fontSize: 12, fontWeight: '600' },

  // Healthy banner
  healthyBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#DCFCE7', padding: 12, borderRadius: 10, marginTop: 12 },
  healthyText: { fontSize: 13, fontWeight: '600', color: '#166534' },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#22C55E', marginTop: 12 },
  emptyText: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
