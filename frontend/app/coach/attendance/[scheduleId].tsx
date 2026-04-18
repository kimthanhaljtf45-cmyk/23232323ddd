import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  useCoachAttendance,
  useMarkAttendance,
} from '../../../src/modules/coach/hooks/useCoachAttendance';
import { CoachAttendanceRow } from '../../../src/modules/coach/components/CoachAttendanceRow';
import { AttendanceSummary } from '../../../src/modules/coach/components/AttendanceSummary';
import { AttendanceStatus } from '../../../src/services/api/attendance';

export default function CoachAttendanceScreen() {
  const { scheduleId } = useLocalSearchParams<{ scheduleId: string }>();
  const router = useRouter();

  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useCoachAttendance(scheduleId || '');

  const markMutation = useMarkAttendance(scheduleId || '');

  const markedCount = useMemo(() => {
    if (!data) return 0;
    return data.children.filter((c) => !!c.status).length;
  }, [data]);

  const pendingCount = useMemo(() => {
    if (!data) return 0;
    return data.children.filter((c) => !c.status).length;
  }, [data]);

  const handleSelectStatus = async (
    childId: string,
    status: Exclude<AttendanceStatus, null>,
  ) => {
    if (!data?.schedule) return;

    try {
      await markMutation.mutateAsync({
        childId,
        scheduleId: data.schedule.id,
        date: data.schedule.date,
        status,
        comment: '',
      });
    } catch {
      Alert.alert('Помилка', 'Не вдалося зберегти attendance');
    }
  };

  if (isLoading || !data) {
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
        <Text style={styles.headerTitle}>Attendance</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <View style={styles.scheduleInfo}>
          <Text style={styles.groupName}>
            {data.schedule.groupName}
          </Text>

          <Text style={styles.scheduleDetails}>
            {data.schedule.date} • {data.schedule.time} • {data.schedule.location}
          </Text>
        </View>

        <AttendanceSummary
          total={data.children.length}
          marked={markedCount}
          pending={pendingCount}
        />

        {pendingCount === 0 && (
          <View style={styles.completeAlert}>
            <Ionicons name="checkmark-circle" size={20} color="#166534" />
            <Text style={styles.completeText}>
              Всі учні відмічені
            </Text>
          </View>
        )}

        {data.children.map((child) => (
          <CoachAttendanceRow
            key={child.childId}
            child={child}
            isSaving={markMutation.isPending}
            onSelectStatus={(status) => handleSelectStatus(child.childId, status)}
          />
        ))}
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
  scheduleInfo: {
    marginBottom: 16,
  },
  groupName: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F0F10',
    marginBottom: 4,
  },
  scheduleDetails: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  completeAlert: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeText: {
    color: '#166534',
    fontWeight: '800',
    fontSize: 14,
  },
});
