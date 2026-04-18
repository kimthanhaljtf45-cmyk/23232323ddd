import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

export interface CoachAction {
  id: string;
  type: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  childId?: string;
  childName?: string;
  title: string;
  description?: string;
}

interface CoachActionsBlockProps {
  actions: CoachAction[];
  onActionPress?: (action: CoachAction) => void;
}

const PRIORITY_COLORS = {
  critical: { bg: '#FEE2E2', text: '#DC2626', icon: '#DC2626' },
  high: { bg: '#FFEDD5', text: '#EA580C', icon: '#EA580C' },
  medium: { bg: '#FEF3C7', text: '#D97706', icon: '#D97706' },
  low: { bg: '#DCFCE7', text: '#16A34A', icon: '#16A34A' },
};

const ACTION_ICONS: Record<string, string> = {
  'CALL_PARENT': 'call',
  'MESSAGE_PARENT': 'chatbubble',
  'SEND_PAYMENT_REMINDER': 'card',
  'CHECK_PROGRESS': 'trending-up',
  'MARK_ATTENDANCE': 'checkbox',
  'DEFAULT': 'alert-circle',
};

export const CoachActionsBlock: React.FC<CoachActionsBlockProps> = ({
  actions,
  onActionPress,
}) => {
  if (!actions || actions.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Дії</Text>
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
          <Text style={styles.emptyText}>Все під контролем!</Text>
          <Text style={styles.emptySubtext}>Немає термінових дій</Text>
        </View>
      </View>
    );
  }

  const handlePress = (action: CoachAction) => {
    if (onActionPress) {
      onActionPress(action);
    } else if (action.childId) {
      router.push(`/child/${action.childId}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Дії</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{actions.length}</Text>
        </View>
      </View>
      
      <View style={styles.list}>
        {actions.slice(0, 5).map((action) => {
          const colors = PRIORITY_COLORS[action.priority] || PRIORITY_COLORS.medium;
          const iconName = ACTION_ICONS[action.type] || ACTION_ICONS.DEFAULT;
          
          return (
            <TouchableOpacity
              key={action.id}
              style={styles.actionCard}
              onPress={() => handlePress(action)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: colors.bg }]}>
                <Ionicons name={iconName as any} size={20} color={colors.icon} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                {action.childName && (
                  <Text style={styles.actionChild}>{action.childName}</Text>
                )}
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: colors.bg }]}>
                <Text style={[styles.priorityText, { color: colors.text }]}>
                  {action.priority === 'critical' ? 'Терміново' :
                   action.priority === 'high' ? 'Важливо' :
                   action.priority === 'medium' ? 'Середнє' : 'Низьке'}
                </Text>
              </View>
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
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  badge: {
    backgroundColor: '#E30613',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  list: {
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F10',
  },
  actionChild: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F0F10',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
});
