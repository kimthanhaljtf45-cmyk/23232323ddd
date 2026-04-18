import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

export default function BillingIssuesScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billing-reconciliation'],
    queryFn: () => api.get('/admin/billing-reconciliation'),
  });

  const runMutation = useMutation({
    mutationFn: () => api.post('/admin/billing-reconciliation/run'),
    onSuccess: (res) => {
      Alert.alert('Reconciliation', `Issues found: ${res.issuesFound}\nCritical: ${res.critical}\nWarning: ${res.warning}`);
      queryClient.invalidateQueries({ queryKey: ['billing-reconciliation'] });
    },
    onError: () => Alert.alert('Error', 'Failed to run reconciliation'),
  });

  if (isLoading) return <View style={s.center}><ActivityIndicator size="large" color="#DC2626" /></View>;

  const issues = data?.issues || [];
  const criticalIssues = issues.filter((i: any) => i.severity === 'CRITICAL');
  const warningIssues = issues.filter((i: any) => i.severity === 'WARNING');

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Billing Issues</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { backgroundColor: data?.totalIssues > 0 ? '#FEF2F2' : '#F0FDF4' }]}>
            <Text style={[s.summaryNum, { color: data?.totalIssues > 0 ? '#DC2626' : '#059669' }]}>{data?.totalIssues || 0}</Text>
            <Text style={s.summaryLabel}>Total Issues</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[s.summaryNum, { color: '#DC2626' }]}>{data?.critical || 0}</Text>
            <Text style={s.summaryLabel}>Critical</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[s.summaryNum, { color: '#D97706' }]}>{data?.warning || 0}</Text>
            <Text style={s.summaryLabel}>Warning</Text>
          </View>
        </View>

        {data?.lastRun && (
          <Text style={s.lastRun}>Last run: {new Date(data.lastRun).toLocaleString('uk-UA')}</Text>
        )}

        <TouchableOpacity
          testID="run-reconciliation-btn"
          style={s.runBtn}
          onPress={() => runMutation.mutate()}
          disabled={runMutation.isPending}
        >
          {runMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="refresh" size={18} color="#fff" />
              <Text style={s.runBtnText}>Run Reconciliation Now</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Issues List */}
        {issues.length === 0 ? (
          <View style={s.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#10B981" />
            <Text style={s.emptyTitle}>No billing issues</Text>
            <Text style={s.emptySubtitle}>All subscriptions and invoices are in sync</Text>
          </View>
        ) : (
          <>
            {criticalIssues.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionTitle, { color: '#DC2626' }]}>Critical Issues</Text>
                {criticalIssues.map((issue: any, idx: number) => (
                  <View key={idx} style={[s.issueCard, { borderLeftColor: '#DC2626' }]}>
                    <View style={s.issueHeader}>
                      <Ionicons name="alert-circle" size={18} color="#DC2626" />
                      <Text style={s.issueType}>{issue.type.replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={s.issueDetails}>{issue.details}</Text>
                    {issue.subId && <Text style={s.issueId}>Sub: {issue.subId}</Text>}
                    {issue.invoiceId && <Text style={s.issueId}>Invoice: {issue.invoiceId}</Text>}
                  </View>
                ))}
              </View>
            )}

            {warningIssues.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionTitle, { color: '#D97706' }]}>Warning Issues</Text>
                {warningIssues.map((issue: any, idx: number) => (
                  <View key={idx} style={[s.issueCard, { borderLeftColor: '#D97706' }]}>
                    <View style={s.issueHeader}>
                      <Ionicons name="warning" size={18} color="#D97706" />
                      <Text style={s.issueType}>{issue.type.replace(/_/g, ' ')}</Text>
                    </View>
                    <Text style={s.issueDetails}>{issue.details}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  summaryNum: { fontSize: 24, fontWeight: '800' },
  summaryLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginTop: 2 },
  lastRun: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#DC2626', marginHorizontal: 16, marginTop: 16, marginBottom: 20, paddingVertical: 14, borderRadius: 12 },
  runBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  issueCard: { backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 4 },
  issueHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  issueType: { fontSize: 13, fontWeight: '700', color: '#111' },
  issueDetails: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  issueId: { fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace' },
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  emptySubtitle: { fontSize: 14, color: '#9CA3AF' },
});
