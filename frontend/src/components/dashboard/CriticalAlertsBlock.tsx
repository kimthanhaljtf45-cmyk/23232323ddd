import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

interface Alert {
  id?: string;
  type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  childId?: string;
  childName?: string;
  screen?: string;
  params?: Record<string, any>;
}

interface Props {
  alerts: Alert[];
}

export function CriticalAlertsBlock({ alerts }: Props) {
  if (!alerts || alerts.length === 0) return null;

  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'warning');
  if (criticalAlerts.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="warning" size={20} color="#fff" />
        <Text style={styles.title}>Потрібна увага</Text>
        <Text style={styles.count}>{criticalAlerts.length}</Text>
      </View>
      
      {criticalAlerts.slice(0, 3).map((alert, index) => (
        <TouchableOpacity
          key={alert.id || index}
          style={styles.alertCard}
          onPress={() => {
            if (alert.childId) {
              router.push(`/child/${alert.childId}`);
            } else if (alert.screen) {
              router.push(alert.screen as any);
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.alertContent}>
            <Text style={styles.alertName}>{alert.childName || alert.title}</Text>
            <Text style={styles.alertMessage}>{alert.message}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#DC2626',
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alertCard: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  alertMessage: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
});
