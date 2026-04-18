import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export interface AtRiskStudent {
  childId: string;
  name: string;
  status: 'critical' | 'warning' | 'good' | 'stable';
  risk: number;
  reasons: string[];
}

interface AtRiskStudentsBlockProps {
  students: AtRiskStudent[];
  onStudentPress?: (student: AtRiskStudent) => void;
}

const STATUS_STYLES = {
  critical: { bg: '#FEE2E2', text: '#DC2626', label: 'Критичний' },
  warning: { bg: '#FEF3C7', text: '#D97706', label: 'Увага' },
  stable: { bg: '#DBEAFE', text: '#2563EB', label: 'Стабільний' },
  good: { bg: '#DCFCE7', text: '#16A34A', label: 'Добре' },
};

export const AtRiskStudentsBlock: React.FC<AtRiskStudentsBlockProps> = ({
  students,
  onStudentPress,
}) => {
  const criticalCount = students.filter(s => s.status === 'critical').length;
  const warningCount = students.filter(s => s.status === 'warning').length;

  if (students.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Учні в ризику</Text>
        <View style={styles.emptyState}>
          <Ionicons name="shield-checkmark" size={40} color="#22C55E" />
          <Text style={styles.emptyText}>Всі учні в нормі!</Text>
        </View>
      </View>
    );
  }

  const handlePress = (student: AtRiskStudent) => {
    if (onStudentPress) {
      onStudentPress(student);
    } else {
      router.push(`/child/${student.childId}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Учні в ризику</Text>
        <View style={styles.counters}>
          {criticalCount > 0 && (
            <View style={[styles.counterBadge, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="alert-circle" size={12} color="#DC2626" />
              <Text style={[styles.counterText, { color: '#DC2626' }]}>{criticalCount}</Text>
            </View>
          )}
          {warningCount > 0 && (
            <View style={[styles.counterBadge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="warning" size={12} color="#D97706" />
              <Text style={[styles.counterText, { color: '#D97706' }]}>{warningCount}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.list}>
        {students.slice(0, 5).map((student) => {
          const statusStyle = STATUS_STYLES[student.status] || STATUS_STYLES.stable;
          
          return (
            <TouchableOpacity
              key={student.childId}
              style={styles.studentCard}
              onPress={() => handlePress(student)}
              activeOpacity={0.7}
            >
              <View style={styles.studentHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{student.name.charAt(0)}</Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {statusStyle.label}
                    </Text>
                  </View>
                </View>
                <View style={styles.riskScore}>
                  <Text style={[styles.riskValue, { color: student.risk >= 70 ? '#DC2626' : student.risk >= 50 ? '#D97706' : '#16A34A' }]}>
                    {student.risk}%
                  </Text>
                  <Text style={styles.riskLabel}>ризик</Text>
                </View>
              </View>
              
              {student.reasons.length > 0 && (
                <View style={styles.reasonsList}>
                  {student.reasons.slice(0, 2).map((reason, idx) => (
                    <View key={idx} style={styles.reasonItem}>
                      <Ionicons name="alert-circle" size={12} color="#9CA3AF" />
                      <Text style={styles.reasonText}>{reason}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  counters: {
    flexDirection: 'row',
    gap: 6,
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  list: {
    gap: 8,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F0F10',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  riskScore: {
    alignItems: 'center',
  },
  riskValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  riskLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  reasonsList: {
    marginTop: 10,
    gap: 4,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasonText: {
    fontSize: 12,
    color: '#6B7280',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
});
