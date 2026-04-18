import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';

interface FeedPost {
  id: string;
  title: string;
  body: string;
  type: string;
  isPinned?: boolean;
  publishedAt: string;
}

export function FeedPreviewBlock({ items }: { items: FeedPost[] }) {
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="newspaper" size={20} color={colors.primary} />
        <Text style={styles.title}>Новини</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/feed' as any)}>
          <Text style={styles.seeAll}>Всі</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.card}>
        {items.map((post, index) => (
          <TouchableOpacity
            key={post.id}
            style={[styles.postRow, index > 0 && styles.postRowBorder]}
            onPress={() => router.push(`/(tabs)/feed?postId=${post.id}` as any)}
          >
            {post.isPinned && (
              <Ionicons name="pin" size={14} color={colors.warning} style={styles.pinIcon} />
            )}
            <View style={styles.postContent}>
              <Text style={styles.postTitle} numberOfLines={1}>{post.title}</Text>
              <Text style={styles.postBody} numberOfLines={2}>{post.body}</Text>
            </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.subtitle,
    color: colors.text,
    marginLeft: spacing.xs,
    flex: 1,
  },
  seeAll: {
    ...typography.bodySmall,
    color: colors.primary,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  postRow: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  postRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pinIcon: {
    marginRight: spacing.xs,
    marginTop: 2,
  },
  postContent: {
    flex: 1,
  },
  postTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  postBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
