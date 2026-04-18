import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface Child {
  id: string;
  name: string;
  belt: string;
  nextBelt?: string;
  progress: number;
  attendance: number;
  status: 'good' | 'warning' | 'critical';
  discipline?: number;
}

interface Props {
  children: Child[];
}

export function ChildrenOverviewBlock({ children }: Props) {
  if (!children || children.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Мої діти</Text>
      
      {children.map((child) => (
        <TouchableOpacity
          key={child.id}
          style={styles.childCard}
          onPress={() => router.push(`/child/${child.id}`)}
          activeOpacity={0.8}
        >
          <View style={styles.childHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{child.name.charAt(0)}</Text>
            </View>
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{child.name}</Text>
              <Text style={styles.beltText}>
                {child.belt} {child.nextBelt ? `→ ${child.nextBelt}` : ''} 
                {child.progress > 0 && ` (${child.progress}%)`}
              </Text>
            </View>
            <View style={[
              styles.statusBadge,
              child.status === 'critical' && styles.statusCritical,
              child.status === 'warning' && styles.statusWarning,
              child.status === 'good' && styles.statusGood,
            ]}>
              <Ionicons 
                name={
                  child.status === 'critical' ? 'alert-circle' : 
                  child.status === 'warning' ? 'warning' : 'checkmark-circle'
                } 
                size={16} 
                color={
                  child.status === 'critical' ? '#DC2626' :
                  child.status === 'warning' ? '#F59E0B' : '#22C55E'
                } 
              />
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{child.attendance}%</Text>
              <Text style={styles.statLabel}>Відвідуваність</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{child.discipline || child.attendance}%</Text>
              <Text style={styles.statLabel}>Дисципліна</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{child.progress}%</Text>
              <Text style={styles.statLabel}>До поясу</Text>
            </View>
          </View>

          {child.status !== 'good' && (
            <View style={[
              styles.statusMessage,
              child.status === 'critical' && styles.statusMessageCritical,
              child.status === 'warning' && styles.statusMessageWarning,
            ]}>
              <Ionicons 
                name={child.status === 'critical' ? 'alert-circle' : 'warning'} 
                size={16} 
                color={child.status === 'critical' ? '#DC2626' : '#F59E0B'} 
              />
              <Text style={[
                styles.statusText,
                child.status === 'critical' && styles.statusTextCritical,
                child.status === 'warning' && styles.statusTextWarning,
              ]}>
                {child.status === 'critical' ? 'Потребує уваги' : 'Рекомендуємо звернути увагу'}
              </Text>
            </View>
          )}

          <View style={styles.cardFooter}>
            <Text style={styles.viewDetails}>Деталі</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  childCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  childInfo: {
    flex: 1,
    marginLeft: 12,
  },
  childName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  beltText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCritical: {
    backgroundColor: '#FEF2F2',
  },
  statusWarning: {
    backgroundColor: '#FFFBEB',
  },
  statusGood: {
    backgroundColor: '#F0FDF4',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  statusMessageCritical: {
    backgroundColor: '#FEF2F2',
  },
  statusMessageWarning: {
    backgroundColor: '#FFFBEB',
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  statusTextCritical: {
    color: '#DC2626',
  },
  statusTextWarning: {
    color: '#D97706',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  viewDetails: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginRight: 4,
  },
});
