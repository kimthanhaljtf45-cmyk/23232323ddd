import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Image } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';

const ACTIVE_COLOR = '#E30613';
const INACTIVE_COLOR = '#9CA3AF';

function OwnerHeader() {
  const router = useRouter();
  const user = useStore((state) => state.user);
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      try {
        const res = await api.get('/owner/notifications');
        setUnread((res.data || res)?.unread || 0);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []));

  return (
    <View style={styles.customHeaderRow}>
      <View style={styles.logoContainer}>
        <View style={styles.ownerBadge}>
          <Text style={styles.ownerBadgeText}>OWNER</Text>
        </View>
        <Text style={styles.logoText} numberOfLines={1}>ATAKA</Text>
      </View>
      <View style={styles.headerRight}>
        <Pressable testID="owner-notifications-bell" onPress={() => router.push('/notifications' as any)} style={styles.bellButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="notifications-outline" size={22} color="#1F2937" />
          {unread > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>
        <Pressable testID="owner-avatar" onPress={() => router.push('/profile' as any)} style={styles.profileButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{user?.firstName?.[0]?.toUpperCase() || 'O'}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function OwnerTabLayout() {
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

  if (user.role !== 'OWNER') {
    if (user.role === 'ADMIN') return <Redirect href="/(admin)" />;
    if (user.role === 'COACH') return <Redirect href="/(coach)" />;
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
            <OwnerHeader />
          </SafeAreaView>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Огляд',
          tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Гроші',
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="team"
        options={{
          title: 'Команда',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="marketplace"
        options={{
          title: 'Продажі',
          tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
          title: 'Клуб',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#6B7280' },
  tabBar: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', height: 86, paddingBottom: 26, paddingTop: 10, paddingHorizontal: 4 },
  tabBarLabel: { fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  header: { backgroundColor: '#FFF', elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', height: 72 },
  headerSafe: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  customHeaderRow: { height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#FFF' },
  headerTitle: { fontWeight: '800', fontSize: 18, color: '#0F0F10' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  ownerBadge: { backgroundColor: '#E30613', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  ownerBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  logoText: { fontSize: 20, fontWeight: '900', color: '#0F0F10', letterSpacing: -0.5, flexShrink: 1 },
  profileButton: { marginLeft: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  bellButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  bellBadge: { position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E30613', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: '#FFF' },
  bellBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E30613', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FEE2E2' },
  avatarImage: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#FEE2E2' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
