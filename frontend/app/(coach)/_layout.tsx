import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Image } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';

const ACTIVE_COLOR = '#E30613';
const INACTIVE_COLOR = '#9CA3AF';

function CoachHeader() {
  const router = useRouter();
  const user = useStore((state) => state.user);
  const [unread, setUnread] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const res = await api.get('/notifications/unread-count');
          const d = (res as any).data || res;
          setUnread((d as any)?.unread || (d as any)?.count || 0);
        } catch {}
      };
      load();
      const interval = setInterval(load, 30000);
      return () => clearInterval(interval);
    }, []),
  );

  return (
    <View style={styles.customHeaderRow}>
      <View style={styles.logoContainer}>
        <View style={styles.coachBadge}>
          <Text style={styles.coachBadgeText}>COACH</Text>
        </View>
        <Text style={styles.logoText} numberOfLines={1}>ATAKA</Text>
      </View>
      <View style={styles.headerRight}>
        <Pressable
          testID="coach-notifications-bell"
          onPress={() => router.push('/notifications' as any)}
          style={styles.bellButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="notifications-outline" size={22} color="#1F2937" />
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          testID="coach-avatar"
          onPress={() => router.push('/profile' as any)}
          style={styles.profileButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.firstName?.[0]?.toUpperCase() || 'C'}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * COACH X10 LAYOUT — 4 tabs (Панель / Учні / Розклад / Чат)
 * Профіль + налаштування відкриваються через аватар справа у header
 * (паттерн платформи: owner/parent/student/admin).
 */
export default function CoachTabLayout() {
  const { user, authState } = useStore();

  if (authState === 'loading' || authState === 'idle') {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACTIVE_COLOR} />
        <Text style={styles.loadingText}>Завантаження...</Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (user.role !== 'COACH' && user.role !== 'ADMIN') {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerShown: true,
        header: () => (
          <SafeAreaView edges={['top']} style={styles.headerSafe}>
            <CoachHeader />
          </SafeAreaView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Панель',
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Учні',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Розклад',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Чат',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="performance"
        options={{
          title: 'Результат',
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
        }}
      />
      {/* Hidden legacy screens — kept to not break existing routes */}
      <Tabs.Screen name="groups" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
  tabBar: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: 86,
    paddingBottom: 26,
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  tabBarLabel: { fontSize: 11, fontWeight: '600' },
  headerSafe: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  customHeaderRow: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFF',
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  coachBadge: {
    backgroundColor: '#0F0F10',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coachBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  logoText: { fontWeight: '800', fontSize: 18, color: '#0F0F10' },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 4,
    maxWidth: 140,
  },
  contextPillRisk: { backgroundColor: '#FEE2E2' },
  contextPillT: { fontSize: 11, fontWeight: '700', color: '#6B7280' },
  contextPillTRisk: { color: '#EF4444' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  bellButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E30613',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  bellBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  profileButton: {},
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E30613',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
