import React from 'react';
import { Pressable, Text, View, StyleSheet, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

type Priority = 'HIGH' | 'MEDIUM' | 'LOW' | 'critical' | 'high' | 'medium' | 'low';
type ActionType = 'LOW_ATTENDANCE' | 'PAYMENT_OVERDUE' | 'COMPETITION_CONFIRMATION' | 'ABSENCE_STREAK' | 'PROGRESS_STAGNATION' | 'BELT_READY' | string;

interface Action {
  id: string;
  childId?: string;
  childName: string;
  action: string;
  actionType?: ActionType;
  priority: Priority;
  parentId?: string;
  parentPhone?: string;
  parentName?: string;
}

interface Props {
  actions: Action[];
  onActionComplete?: (actionId: string) => void;
  onMessagePress?: (action: Action, prefillMessage?: string) => void;
  onCallPress?: (action: Action) => void;
}

const ACTION_TEMPLATES: Record<string, string> = {
  'LOW_ATTENDANCE': 'Доброго дня! Підкажіть, будь ласка, чи зможе дитина відновити відвідування цього тижня?',
  'PAYMENT_OVERDUE': 'Доброго дня! Нагадуємо про оплату занять. Якщо є питання — підкажу.',
  'COMPETITION_CONFIRMATION': 'Доброго дня! Потрібно підтвердити участь у змаганнях. Чекаю на вашу відповідь.',
  'ABSENCE_STREAK': 'Доброго дня! Помітив, що дитина пропустила кілька тренувань. Чи все гаразд?',
  'PROGRESS_STAGNATION': 'Доброго дня! Хочу обговорити прогрес дитини та як ми можемо покращити результати.',
  'BELT_READY': 'Доброго дня! Радий повідомити, що дитина готова до атестації на новий пояс!',
};

const priorityColors: Record<string, { bg: string; text: string; border: string }> = {
  'HIGH': { bg: '#FEE2E2', text: '#991B1B', border: '#F87171' },
  'critical': { bg: '#FEE2E2', text: '#991B1B', border: '#F87171' },
  'MEDIUM': { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
  'high': { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
  'medium': { bg: '#FEF3C7', text: '#92400E', border: '#FBBF24' },
  'LOW': { bg: '#DCFCE7', text: '#166534', border: '#4ADE80' },
  'low': { bg: '#DCFCE7', text: '#166534', border: '#4ADE80' },
};

const priorityLabels: Record<string, string> = {
  'HIGH': 'Терміново',
  'critical': 'Терміново',
  'MEDIUM': 'Важливо',
  'high': 'Важливо',
  'medium': 'Важливо',
  'LOW': 'Звичайно',
  'low': 'Звичайно',
};

export default function CoachActionQueueEnhanced({ 
  actions, 
  onActionComplete, 
  onMessagePress, 
  onCallPress 
}: Props) {
  
  const handleMessage = (action: Action) => {
    const prefillMessage = action.actionType ? ACTION_TEMPLATES[action.actionType] : undefined;
    
    if (onMessagePress) {
      onMessagePress(action, prefillMessage);
    } else {
      // Default navigation to messages with parent
      if (action.parentId) {
        router.push({
          pathname: '/messages',
          params: { 
            recipientId: action.parentId,
            prefill: prefillMessage || ''
          }
        });
      } else {
        Alert.alert(
          'Написати',
          prefillMessage || `Повідомлення для батьків ${action.childName}`,
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleCall = (action: Action) => {
    if (action.parentPhone) {
      const phoneNumber = action.parentPhone.replace(/\D/g, '');
      Linking.openURL(`tel:+${phoneNumber}`).catch(() => {
        Alert.alert('Помилка', 'Не вдалося здійснити дзвінок');
      });
    } else if (onCallPress) {
      onCallPress(action);
    } else {
      Alert.alert('Немає номера', 'Телефон батьків не вказано в системі');
    }
  };

  const handleComplete = (action: Action) => {
    Alert.alert(
      'Підтвердження',
      `Позначити дію "${action.action}" як виконану?`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { 
          text: 'Виконано', 
          onPress: () => onActionComplete?.(action.id)
        }
      ]
    );
  };

  if (!actions || actions.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={22} color="#22C55E" />
          <Text style={styles.headerTitle}>Черга дій</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Все зроблено! Немає дій на сьогодні 🎉</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="list" size={22} color="#E30613" />
        <Text style={styles.headerTitle}>Черга дій</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{actions.length}</Text>
        </View>
      </View>

      {actions.map((item) => {
        const colors = priorityColors[item.priority] || priorityColors.MEDIUM;
        const label = priorityLabels[item.priority] || 'Важливо';

        return (
          <View 
            key={item.id} 
            style={[styles.item, { borderLeftColor: colors.border }]}
          >
            {/* Header */}
            <View style={styles.itemHeader}>
              <View style={styles.nameRow}>
                <Text style={styles.itemName}>{item.childName}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: colors.bg }]}>
                  <Text style={[styles.priorityText, { color: colors.text }]}>{label}</Text>
                </View>
              </View>
            </View>

            {/* Action description */}
            <Text style={styles.itemAction}>{item.action}</Text>

            {/* Parent info */}
            {item.parentName && (
              <Text style={styles.parentInfo}>Батьки: {item.parentName}</Text>
            )}

            {/* Action Buttons Row */}
            <View style={styles.buttonsRow}>
              <Pressable 
                style={[styles.actionBtn, styles.messageBtn]}
                onPress={() => handleMessage(item)}
              >
                <Ionicons name="chatbubble-outline" size={16} color="#3B82F6" />
                <Text style={styles.messageBtnText}>Написати</Text>
              </Pressable>

              <Pressable 
                style={[styles.actionBtn, styles.callBtn]}
                onPress={() => handleCall(item)}
                disabled={!item.parentPhone}
              >
                <Ionicons 
                  name="call-outline" 
                  size={16} 
                  color={item.parentPhone ? '#22C55E' : '#9CA3AF'} 
                />
                <Text style={[
                  styles.callBtnText,
                  !item.parentPhone && styles.disabledText
                ]}>
                  {item.parentPhone ? 'Подзвонити' : 'Немає №'}
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionBtn, styles.completeBtn]}
                onPress={() => handleComplete(item)}
              >
                <Ionicons name="checkmark" size={16} color="#059669" />
                <Text style={styles.completeBtnText}>Виконано</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
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
    fontSize: 17,
    fontWeight: '800',
    color: '#0F0F10',
  },
  badge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E30613',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#22C55E',
    fontSize: 14,
    fontWeight: '500',
  },
  item: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  itemHeader: {
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
  itemName: {
    fontWeight: '700',
    fontSize: 15,
    color: '#0F0F10',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemAction: {
    color: '#4B5563',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  parentInfo: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  messageBtn: {
    backgroundColor: '#EFF6FF',
  },
  messageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  callBtn: {
    backgroundColor: '#F0FDF4',
  },
  callBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#22C55E',
  },
  completeBtn: {
    backgroundColor: '#ECFDF5',
  },
  completeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
  disabledText: {
    color: '#9CA3AF',
  },
});
