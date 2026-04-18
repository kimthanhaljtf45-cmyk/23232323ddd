import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/theme';

interface Props {
  items: Array<{
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    route: string;
    badge?: number;
    color?: string;
  }>;
}

export function QuickActionsRow({ items }: Props) {
  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.action, index === 0 && styles.primaryAction]}
          onPress={() => router.push(item.route as any)}
          activeOpacity={0.8}
        >
          <Ionicons 
            name={item.icon} 
            size={20} 
            color={index === 0 ? '#fff' : (item.color || '#000')} 
          />
          <Text style={[styles.label, index === 0 && styles.primaryLabel]}>
            {item.label}
          </Text>
          {item.badge !== undefined && item.badge > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 10,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  primaryAction: {
    backgroundColor: '#000',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  primaryLabel: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#DC2626',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
