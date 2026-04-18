import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface QuickAction {
  title: string;
  icon: string;
  screen: string;
  badge?: number;
  params?: Record<string, string>;
}

export function QuickActionsBlock({ items }: { items: QuickAction[] }) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {items.map((action, index) => (
          <TouchableOpacity
            key={`${action.title}-${index}`}
            style={styles.actionButton}
            onPress={() => router.push(action.screen as any)}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={action.icon as any} size={24} color={colors.primary} />
              {action.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{action.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    width: '23%',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: spacing.xs,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionTitle: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
  },
});
