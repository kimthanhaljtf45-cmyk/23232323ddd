import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { colors, spacing, fontSizes, fontWeights } from '@/theme';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: {
    threadId?: string;
    paymentId?: string;
    childId?: string;
    action?: string;
    screen?: string;
    params?: Record<string, any>;
  };
  isRead: boolean;
  createdAt: string;
}

const notificationIcons: Record<string, string> = {
  NEW_MESSAGE: 'chatbubble',
  ABSENCE_REPORTED: 'calendar-outline',
  PAYMENT_CONFIRMED: 'card',
  PAYMENT_APPROVED: 'checkmark-circle',
  TRAINING_REMINDER_24H: 'time-outline',
  TRAINING_REMINDER_2H: 'alarm',
};

const notificationColors: Record<string, string> = {
  NEW_MESSAGE: colors.primary,
  ABSENCE_REPORTED: colors.warning,
  PAYMENT_CONFIRMED: colors.info,
  PAYMENT_APPROVED: colors.success,
  TRAINING_REMINDER_24H: colors.info,
  TRAINING_REMINDER_2H: colors.warning,
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.notifications || []);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadNotifications();
  }, [loadNotifications]);

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      try {
        await api.post('/notifications/read', { notificationId: notification.id });
        setNotifications(prev => 
          prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
        );
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }

    // Navigate based on screen/params or fallback to action
    const { screen, params, action, threadId, paymentId, childId } = notification.data || {};
    
    // Primary: use screen + params if available
    if (screen) {
      try {
        if (params && Object.keys(params).length > 0) {
          router.push({ pathname: screen as any, params });
        } else {
          router.push(screen as any);
        }
        return;
      } catch (e) {
        console.log('Navigation error, falling back to action-based:', e);
      }
    }
    
    // Fallback: use action-based navigation
    if (action === 'open_thread' && threadId) {
      router.push(`/messages/${threadId}` as any);
    } else if (action === 'open_payment' && paymentId) {
      router.push(`/payments/${paymentId}` as any);
    } else if (action === 'open_schedule') {
      router.push('/(tabs)/schedule' as any);
    } else if (action === 'open_attendance') {
      router.push('/(tabs)' as any);
    } else if (action === 'open_progress' && childId) {
      router.push(`/children/${childId}` as any);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Щойно';
    if (diffMins < 60) return `${diffMins} хв`;
    if (diffHours < 24) return `${diffHours} год`;
    if (diffDays === 1) return 'Вчора';
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const iconName = notificationIcons[item.type] || 'notifications';
    const iconColor = notificationColors[item.type] || colors.primary;

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          !item.isRead && styles.unreadItem
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={iconName as any} size={24} color={iconColor} />
        </View>
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, !item.isRead && styles.unreadTitle]}>
              {item.title}
            </Text>
            <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.body} numberOfLines={2}>
            {item.body}
          </Text>
        </View>
        {!item.isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header with working back button */}
      <View style={styles.customHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          testID="back-btn"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.customHeaderTitle}>Сповіщення</Text>
          {unreadCount > 0 ? (
            <Text style={styles.customHeaderSub}>{unreadCount} непрочитаних</Text>
          ) : null}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.headerButtonText}>Прочитати всі</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Завантаження...</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="notifications-off-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Немає сповіщень</Text>
          <Text style={styles.emptyText}>
            Тут з'являться повідомлення про тренування, оплати та інше
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerButton: {
    marginRight: spacing.md,
  },
  backButton: {
    marginLeft: spacing.sm,
    padding: 4,
  },
  headerButtonText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
  },
  emptyTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semibold,
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptyText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  unreadItem: {
    backgroundColor: colors.backgroundSecondary,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadTitle: {
    fontWeight: fontWeights.semibold,
  },
  time: {
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
  },
  body: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
    marginTop: 6,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 76,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customHeaderTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.bold,
    color: colors.text,
  },
  customHeaderSub: {
    fontSize: fontSizes.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
