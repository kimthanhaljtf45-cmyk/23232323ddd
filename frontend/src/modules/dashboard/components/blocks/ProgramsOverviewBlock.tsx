import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface Program {
  id: string;
  title: string;
  description: string;
  ageRange: string;
  icon: string;
}

export function ProgramsOverviewBlock({ items }: { items: Program[] }) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Наші програми</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {items.map((program) => (
          <TouchableOpacity key={program.id} style={styles.card}>
            <Ionicons name={program.icon as any} size={32} color={colors.primary} />
            <Text style={styles.programTitle}>{program.title}</Text>
            <Text style={styles.programDesc} numberOfLines={2}>{program.description}</Text>
            <Text style={styles.ageRange}>{program.ageRange}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    width: 160,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginLeft: spacing.md,
    ...shadows.sm,
  },
  programTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
  },
  programDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  ageRange: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
  },
});
