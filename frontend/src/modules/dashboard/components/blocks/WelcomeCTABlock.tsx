import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/theme';

interface WelcomeCTAItem {
  title: string;
  subtitle: string;
  primaryAction: { title: string; screen: string };
  secondaryAction: { title: string; screen: string };
}

export function WelcomeCTABlock({ items }: { items: WelcomeCTAItem[] }) {
  const router = useRouter();
  const item = items[0];

  if (!item) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => router.push(item.primaryAction.screen as any)}
      >
        <Text style={styles.primaryButtonText}>{item.primaryAction.title}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push(item.secondaryAction.screen as any)}
      >
        <Text style={styles.secondaryButtonText}>{item.secondaryAction.title}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.background,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.background,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    width: '100%',
  },
  primaryButtonText: {
    ...typography.button,
    color: colors.primary,
    textAlign: 'center',
  },
  secondaryButton: {
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    ...typography.body,
    color: colors.background,
    textDecorationLine: 'underline',
  },
});
