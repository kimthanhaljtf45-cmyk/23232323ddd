import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertCardProps {
  title: string;
  message: string;
  severity: AlertSeverity;
  onPress?: () => void;
  onResolve?: () => void;
  showResolveButton?: boolean;
}

const severityConfig = {
  info: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
    iconColor: '#3B82F6',
    icon: 'information-circle' as const,
  },
  warning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
    iconColor: '#F59E0B',
    icon: 'warning' as const,
  },
  critical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    iconColor: '#EF4444',
    icon: 'alert-circle' as const,
  },
};

export function AlertCard({
  title,
  message,
  severity,
  onPress,
  onResolve,
  showResolveButton = true,
}: AlertCardProps) {
  const config = severityConfig[severity];

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: config.backgroundColor, borderLeftColor: config.borderColor },
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.iconContainer}>
        <Ionicons name={config.icon} size={24} color={config.iconColor} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>

      {showResolveButton && onResolve && (
        <TouchableOpacity
          style={styles.resolveButton}
          onPress={onResolve}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="checkmark-circle-outline" size={24} color="#6B7280" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 12,
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
  message: {
    fontSize: 13,
    color: '#6B7280',
  },
  resolveButton: {
    padding: 4,
    marginLeft: 8,
  },
});
