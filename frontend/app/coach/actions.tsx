import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../src/lib/api';
import { CoachActionCard } from '../../src/components/CoachActionCard';

export default function CoachActionsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['coach-actions'],
    queryFn: () => api.getCoachActions(),
  });

  const completeMutation = useMutation({
    mutationFn: (actionId: string) => api.completeCoachAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-actions'] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: (actionId: string) => api.snoozeCoachAction(actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-actions'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncCoachActions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-actions'] });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleComplete = (actionId: string) => {
    completeMutation.mutate(actionId);
  };

  const handleSnooze = (actionId: string) => {
    snoozeMutation.mutate(actionId);
  };

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleActionPress = (action: any) => {
    if (action.screen && action.params) {
      router.push({
        pathname: action.screen,
        params: action.params,
      });
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const summary = data?.summary || { total: 0, critical: 0, warning: 0, info: 0 };
  const actions = data?.items || [];

  const criticalActions = actions.filter((a: any) => a.severity === 'critical');
  const warningActions = actions.filter((a: any) => a.severity === 'warning');
  const infoActions = actions.filter((a: any) => a.severity === 'info');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Пріоритетні дії</Text>
        <TouchableOpacity
          onPress={handleSync}
          style={styles.syncButton}
          disabled={syncMutation.isPending}
        >
          <Ionicons
            name="refresh"
            size={22}
            color={syncMutation.isPending ? '#9CA3AF' : '#0F0F10'}
          />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryItem, styles.summaryTotal]}>
          <Text style={styles.summaryNumber}>{summary.total}</Text>
          <Text style={styles.summaryLabel}>Всього</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryCritical]}>
          <Text style={[styles.summaryNumber, { color: '#EF4444' }]}>{summary.critical}</Text>
          <Text style={styles.summaryLabel}>Критичних</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryWarning]}>
          <Text style={[styles.summaryNumber, { color: '#F59E0B' }]}>{summary.warning}</Text>
          <Text style={styles.summaryLabel}>Важливих</Text>
        </View>
        <View style={[styles.summaryItem, styles.summaryInfo]}>
          <Text style={[styles.summaryNumber, { color: '#22C55E' }]}>{summary.info}</Text>
          <Text style={styles.summaryLabel}>Інфо</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {actions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            <Text style={styles.emptyTitle}>Все готово!</Text>
            <Text style={styles.emptyText}>
              Немає пріоритетних дій на даний момент
            </Text>
          </View>
        ) : (
          <>
            {/* Critical Actions */}
            {criticalActions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="alert-circle" size={18} color="#EF4444" />
                  <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
                    Критичні ({criticalActions.length})
                  </Text>
                </View>
                {criticalActions.map((action: any) => (
                  <CoachActionCard
                    key={action.id}
                    title={action.title}
                    message={action.message}
                    severity={action.severity}
                    status={action.status}
                    onPress={() => handleActionPress(action)}
                    onComplete={() => handleComplete(action.id)}
                    onSnooze={() => handleSnooze(action.id)}
                  />
                ))}
              </View>
            )}

            {/* Warning Actions */}
            {warningActions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="warning" size={18} color="#F59E0B" />
                  <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>
                    Важливі ({warningActions.length})
                  </Text>
                </View>
                {warningActions.map((action: any) => (
                  <CoachActionCard
                    key={action.id}
                    title={action.title}
                    message={action.message}
                    severity={action.severity}
                    status={action.status}
                    onPress={() => handleActionPress(action)}
                    onComplete={() => handleComplete(action.id)}
                    onSnooze={() => handleSnooze(action.id)}
                  />
                ))}
              </View>
            )}

            {/* Info Actions */}
            {infoActions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle" size={18} color="#22C55E" />
                  <Text style={[styles.sectionTitle, { color: '#22C55E' }]}>
                    Інформаційні ({infoActions.length})
                  </Text>
                </View>
                {infoActions.map((action: any) => (
                  <CoachActionCard
                    key={action.id}
                    title={action.title}
                    message={action.message}
                    severity={action.severity}
                    status={action.status}
                    onPress={() => handleActionPress(action)}
                    onComplete={() => handleComplete(action.id)}
                    onSnooze={() => handleSnooze(action.id)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  syncButton: {
    padding: 8,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  summaryTotal: {
    backgroundColor: '#F3F4F6',
  },
  summaryCritical: {
    backgroundColor: '#FEF2F2',
  },
  summaryWarning: {
    backgroundColor: '#FFFBEB',
  },
  summaryInfo: {
    backgroundColor: '#F0FDF4',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F0F10',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
});
