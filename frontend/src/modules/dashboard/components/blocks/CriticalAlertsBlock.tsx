import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface AlertItem {
  type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  childId?: string;
  screen?: string;
  params?: Record<string, string>;
}

export function CriticalAlertsBlock({ items }: { items: AlertItem[] }) {
  const router = useRouter();

  if (items.length === 0) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return colors.error;
      case 'warning': return colors.warning;
      default: return colors.info;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return 'alert-circle';
      case 'warning': return 'warning';
      default: return 'information-circle';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="notifications" size={20} color={colors.error} />
        <Text style={styles.title}>Увага</Text>
      </View>
      {items.map((item, index) => (
        <TouchableOpacity
          key={`${item.type}-${index}`}
          style={[styles.alertCard, { borderLeftColor: getSeverityColor(item.severity) }]}
          onPress={() => item.screen && router.push(item.screen as any)}
        >
          <Ionicons 
            name={getSeverityIcon(item.severity) as any} 
            size={24} 
            color={getSeverityColor(item.severity)} 
          />
          <View style={styles.alertContent}>
            <Text style={styles.alertTitle}>{item.title}</Text>
            <Text style={styles.alertMessage}>{item.message}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.error,
    marginLeft: spacing.xs,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    marginBottom: spacing.xs,
  },
  alertContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  alertTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  alertMessage: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
