import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface Location {
  id: string;
  name: string;
  address: string;
  city?: string;
  district?: string;
}

export function LocationsBlock({ items }: { items: Location[] }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="location" size={20} color={colors.primary} />
        <Text style={styles.title}>Наші зали</Text>
      </View>
      {items.map((location) => (
        <TouchableOpacity key={location.id} style={styles.card}>
          <Ionicons name="business" size={24} color={colors.primary} />
          <View style={styles.info}>
            <Text style={styles.name}>{location.name}</Text>
            <Text style={styles.address}>{location.address}</Text>
            {location.district && <Text style={styles.district}>{location.district}</Text>}
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
    color: colors.text,
    marginLeft: spacing.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.xs,
    ...shadows.sm,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  address: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  district: {
    ...typography.caption,
    color: colors.primary,
  },
});
