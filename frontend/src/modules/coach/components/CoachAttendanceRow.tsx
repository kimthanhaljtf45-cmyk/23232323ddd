import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AttendanceStatus } from '../../../services/api/attendance';
import { AttendanceActionButton } from './AttendanceActionButton';
import { getStatusColors, getStatusLabel } from '../utils/attendanceUi';

interface Props {
  child: {
    childId: string;
    childName: string;
    status: AttendanceStatus;
    reason?: string | null;
    comment?: string | null;
  };
  isSaving: boolean;
  onSelectStatus: (status: Exclude<AttendanceStatus, null>) => void;
}

export function CoachAttendanceRow({
  child,
  isSaving,
  onSelectStatus,
}: Props) {
  const statusStyle = useMemo(() => getStatusColors(child.status), [child.status]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>
          {child.childName}
        </Text>

        <View
          style={[
            styles.badge,
            {
              backgroundColor: statusStyle.bg,
              borderColor: statusStyle.border,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: statusStyle.text }]}>
            {getStatusLabel(child.status)}
          </Text>
        </View>
      </View>

      {!!child.reason && (
        <Text style={styles.reason}>
          Причина: {child.reason}
        </Text>
      )}

      <View style={styles.actions}>
        <AttendanceActionButton
          label="Був"
          backgroundColor="#22C55E"
          textColor="#FFFFFF"
          isActive={child.status === 'PRESENT'}
          onPress={() => onSelectStatus('PRESENT')}
          disabled={isSaving}
        />

        <AttendanceActionButton
          label="Не був"
          backgroundColor="#EF4444"
          textColor="#FFFFFF"
          isActive={child.status === 'ABSENT'}
          onPress={() => onSelectStatus('ABSENT')}
          disabled={isSaving}
        />

        <AttendanceActionButton
          label="Попередив"
          backgroundColor="#F59E0B"
          textColor="#111827"
          isActive={child.status === 'WARNED'}
          onPress={() => onSelectStatus('WARNED')}
          disabled={isSaving}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F0F10',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  reason: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});
