import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../src/theme';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

export default function MessagesInbox() {
  const [threads, setThreads] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadThreads();
  }, []);

  const loadThreads = async () => {
    try {
      setLoading(true);
      const data = await api.getMessagesInbox();
      setThreads(data);
    } catch (error) {
      console.error('Error loading threads:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadThreads();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Повідомлення</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {threads.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Немає повідомлень</Text>
            <Text style={styles.emptyDesc}>
              Зверніться до тренера через профіль дитини
            </Text>
          </View>
        ) : (
          threads.map((thread) => (
            <ThreadItem key={thread.id} thread={thread} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ThreadItem({ thread }: { thread: any }) {
  const otherUser = thread.otherUser;
  const lastMessage = thread.lastMessage;
  const hasUnread = thread.unreadCount > 0;

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return format(parseISO(dateStr), 'HH:mm', { locale: uk });
    } catch {
      return '';
    }
  };

  return (
    <TouchableOpacity
      style={styles.threadItem}
      onPress={() => router.push(`/messages/${thread.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.threadAvatar}>
        <Text style={styles.threadAvatarText}>
          {otherUser?.firstName?.charAt(0) || 'Т'}
        </Text>
      </View>

      <View style={styles.threadContent}>
        <View style={styles.threadHeader}>
          <Text style={[styles.threadName, hasUnread && styles.threadNameUnread]}>
            {otherUser?.firstName} {otherUser?.lastName || ''}
          </Text>
          <Text style={styles.threadTime}>
            {formatTime(lastMessage?.createdAt)}
          </Text>
        </View>
        
        <View style={styles.threadPreview}>
          <Text 
            style={[styles.threadText, hasUnread && styles.threadTextUnread]} 
            numberOfLines={1}
          >
            {lastMessage?.senderRole === 'SYSTEM' ? '⚠️ ' : ''}
            {lastMessage?.text || 'Нова розмова'}
          </Text>
          {hasUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{thread.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing['4xl'],
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: spacing.base,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.text,
  },
  emptyDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  threadItem: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  threadAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  threadAvatarText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.textInverse,
  },
  threadContent: {
    flex: 1,
    justifyContent: 'center',
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  threadName: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
  },
  threadNameUnread: {
    fontWeight: fontWeights.bold,
  },
  threadTime: {
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
  },
  threadPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  threadText: {
    flex: 1,
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
  threadTextUnread: {
    color: colors.text,
    fontWeight: fontWeights.medium,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: fontWeights.bold,
    color: colors.textInverse,
  },
});
