import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { useCoachTodaySchedules } from '../../src/modules/coach/hooks/useCoachAttendance';
import { api } from '../../src/lib/api';
import CoachCompetitionsBlock from '../../src/components/coach/CoachCompetitionsBlock';

export default function CoachSchedulesScreen() {
  const router = useRouter();
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useCoachTodaySchedules();

  const { data: actionsData } = useQuery({
    queryKey: ['coach-actions'],
    queryFn: () => api.getCoachActions(),
  });

  const handleSchedulePress = (scheduleId: string) => {
    router.push(`/coach/attendance/${scheduleId}`);
  };

  const handleActionsPress = () => {
    router.push('/coach/actions');
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const actionsSummary = actionsData?.summary || { total: 0, critical: 0, warning: 0 };
  const hasActions = actionsSummary.total > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Тренування</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Competitions Block - NEW */}
        <CoachCompetitionsBlock />

        {/* Actions Block */}
        {hasActions && (
          <TouchableOpacity
            style={[
              styles.actionsBlock,
              actionsSummary.critical > 0 && styles.actionsBlockCritical,
            ]}
            onPress={handleActionsPress}
            activeOpacity={0.8}
          >
            <View style={styles.actionsContent}>
              <View style={styles.actionsIcon}>
                <Ionicons
                  name={actionsSummary.critical > 0 ? 'alert-circle' : 'list'}
                  size={24}
                  color={actionsSummary.critical > 0 ? '#EF4444' : '#F59E0B'}
                />
              </View>
              <View style={styles.actionsInfo}>
                <Text style={styles.actionsTitle}>
                  Пріоритетні дії
                </Text>
                <Text style={styles.actionsSubtitle}>
                  {actionsSummary.critical > 0
                    ? `${actionsSummary.critical} критичних`
                    : `${actionsSummary.total} завдань`}
                </Text>
              </View>
            </View>
            <View style={styles.actionsBadge}>
              <Text style={styles.actionsBadgeText}>{actionsSummary.total}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}

        <Text style={styles.dateTitle}>
          Сьогодні, {data?.date || ''}
        </Text>

        {data?.schedules.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              Сьогодні немає тренувань
            </Text>
          </View>
        ) : (
          data?.schedules.map((schedule) => (
            <TouchableOpacity
              key={schedule.id}
              style={styles.scheduleCard}
              onPress={() => handleSchedulePress(schedule.id)}
              activeOpacity={0.7}
            >
              <View style={styles.scheduleHeader}>
                <View>
                  <Text style={styles.groupName}>{schedule.groupName}</Text>
                  <Text style={styles.scheduleInfo}>
                    {schedule.time} • {schedule.location}
                  </Text>
                </View>
                
                {schedule.isComplete ? (
                  <View style={styles.completeBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#166534" />
                    <Text style={styles.completeText}>Готово</Text>
                  </View>
                ) : (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingText}>
                      {schedule.markedCount}/{schedule.childrenCount}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${schedule.childrenCount > 0 
                        ? (schedule.markedCount / schedule.childrenCount) * 100 
                        : 0}%`,
                      backgroundColor: schedule.isComplete ? '#22C55E' : '#F59E0B',
                    },
                  ]}
                />
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.childrenCount}>
                  {schedule.childrenCount} учнів
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </TouchableOpacity>
          ))
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
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  dateTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginTop: 12,
  },
  scheduleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 4,
  },
  scheduleInfo: {
    color: '#6B7280',
    fontSize: 14,
  },
  completeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  completeText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pendingText: {
    color: '#92400E',
    fontSize: 12,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childrenCount: {
    color: '#6B7280',
    fontSize: 13,
  },
  actionsBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  actionsBlockCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  actionsContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionsInfo: {
    flex: 1,
  },
  actionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F0F10',
  },
  actionsSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  actionsBadge: {
    backgroundColor: '#E30613',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
  },
  actionsBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
