import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RiskStudent {
  id: string;
  childId?: string;
  name: string;
  childName?: string;
  segment: 'VIP' | 'ACTIVE' | 'WARNING' | 'CHURN_RISK';
  reason: string;
  parentPhone?: string;
  parentName?: string;
  riskScore?: number;
}

interface Props {
  students: RiskStudent[];
  onMessagePress?: (student: RiskStudent) => void;
  onCallPress?: (student: RiskStudent) => void;
}

const segmentColors = {
  VIP: { bg: '#E8F5E9', text: '#2E7D32', border: '#A5D6A7' },
  ACTIVE: { bg: '#E3F2FD', text: '#1565C0', border: '#90CAF9' },
  WARNING: { bg: '#FFF3E0', text: '#EF6C00', border: '#FFCC80' },
  CHURN_RISK: { bg: '#FFEBEE', text: '#C62828', border: '#EF9A9A' },
};

const segmentLabels = {
  VIP: 'VIP',
  ACTIVE: 'Активний',
  WARNING: 'Увага',
  CHURN_RISK: 'Ризик',
};

export default function CoachRiskListEnhanced({ students, onMessagePress, onCallPress }: Props) {
  const handleCall = (student: RiskStudent) => {
    if (student.parentPhone) {
      const phoneNumber = student.parentPhone.replace(/\D/g, '');
      Linking.openURL(`tel:+${phoneNumber}`).catch(() => {
        Alert.alert('Помилка', 'Не вдалося здійснити дзвінок');
      });
    } else if (onCallPress) {
      onCallPress(student);
    } else {
      Alert.alert('Немає номера', 'Телефон батьків не вказано');
    }
  };

  const handleMessage = (student: RiskStudent) => {
    if (onMessagePress) {
      onMessagePress(student);
    } else {
      // Default: open messages screen
      Alert.alert('Повідомлення', `Написати батькам ${student.name}`);
    }
  };

  if (!students || students.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={20} color="#22C55E" />
          <Text style={styles.headerTitle}>Учні в ризику</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Всі учні в порядку! 🎉</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="warning" size={20} color="#EF4444" />
        <Text style={styles.headerTitle}>Учні в ризику</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{students.length}</Text>
        </View>
      </View>

      {students.map((student, index) => {
        const colors = segmentColors[student.segment] || segmentColors.WARNING;
        
        return (
          <View 
            key={student.id || student.childId || index} 
            style={[styles.card, { borderLeftColor: colors.border }]}
          >
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.studentName}>{student.name || student.childName}</Text>
                <View style={[styles.segmentBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.segmentText, { color: colors.text }]}>
                    {segmentLabels[student.segment]}
                  </Text>
                </View>
              </View>
              {student.riskScore !== undefined && (
                <Text style={styles.riskScore}>Risk: {student.riskScore}</Text>
              )}
            </View>

            <Text style={styles.reason}>{student.reason}</Text>

            {student.parentName && (
              <Text style={styles.parentInfo}>Батьки: {student.parentName}</Text>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsRow}>
              <Pressable 
                style={[styles.actionBtn, styles.messageBtn]}
                onPress={() => handleMessage(student)}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#3B82F6" />
                <Text style={styles.messageBtnText}>Написати</Text>
              </Pressable>

              <Pressable 
                style={[styles.actionBtn, styles.callBtn]}
                onPress={() => handleCall(student)}
              >
                <Ionicons name="call-outline" size={18} color="#22C55E" />
                <Text style={styles.callBtnText}>Позвонити</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  badge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#22C55E',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  nameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  studentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F0F10',
  },
  segmentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600',
  },
  riskScore: {
    fontSize: 12,
    color: '#6B7280',
  },
  reason: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
    marginBottom: 8,
  },
  parentInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  messageBtn: {
    backgroundColor: '#EFF6FF',
  },
  messageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  callBtn: {
    backgroundColor: '#F0FDF4',
  },
  callBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
});
