import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ActionSeverity = 'info' | 'warning' | 'critical';
type ActionStatus = 'OPEN' | 'DONE' | 'SNOOZED';

interface CoachActionCardProps {
  title: string;
  message?: string;
  severity: ActionSeverity;
  status: ActionStatus;
  onPress?: () => void;
  onComplete?: () => void;
  onSnooze?: () => void;
}

const severityConfig = {
  info: {
    backgroundColor: '#F0FDF4',
    accentColor: '#22C55E',
    icon: 'checkmark-circle' as const,
  },
  warning: {
    backgroundColor: '#FFFBEB',
    accentColor: '#F59E0B',
    icon: 'time' as const,
  },
  critical: {
    backgroundColor: '#FEF2F2',
    accentColor: '#EF4444',
    icon: 'alert-circle' as const,
  },
};

export function CoachActionCard({
  title,
  message,
  severity,
  status,
  onPress,
  onComplete,
  onSnooze,
}: CoachActionCardProps) {
  const config = severityConfig[severity];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: config.backgroundColor },
        status === 'DONE' && styles.doneContainer,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconBadge, { backgroundColor: config.accentColor }]}>
            <Ionicons name={config.icon} size={16} color="#FFFFFF" />
          </View>
        </View>
        
        <View style={styles.content}>
          <Text style={[styles.title, status === 'DONE' && styles.doneTitle]}>
            {title}
          </Text>
          {message && (
            <Text style={styles.message}>{message}</Text>
          )}
        </View>
      </View>

      {status === 'OPEN' && (onComplete || onSnooze) && (
        <View style={styles.actions}>
          {onSnooze && (
            <TouchableOpacity
              style={styles.snoozeButton}
              onPress={onSnooze}
            >
              <Ionicons name="time-outline" size={18} color="#6B7280" />
              <Text style={styles.snoozeText}>Пізніше</Text>
            </TouchableOpacity>
          )}
          {onComplete && (
            <TouchableOpacity
              style={styles.completeButton}
              onPress={onComplete}
            >
              <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              <Text style={styles.completeText}>Готово</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {status === 'SNOOZED' && (
        <View style={styles.snoozedBadge}>
          <Ionicons name="time" size={14} color="#6B7280" />
          <Text style={styles.snoozedText}>Відкладено</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  doneContainer: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    marginRight: 12,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 4,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 8,
  },
  snoozeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  snoozeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#22C55E',
    gap: 4,
  },
  completeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  snoozedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    gap: 4,
  },
  snoozedText: {
    fontSize: 12,
    color: '#6B7280',
  },
});
