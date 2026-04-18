import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Image } from 'react-native';
import { Tabs, Redirect, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';

const ACTIVE = '#E30613';
const INACTIVE = '#9CA3AF';

/**
 * Header Logo — same pattern as admin/owner/coach
 */
function HeaderLogo() {
  const user = useStore(s => s.user);
  const isAdult = (user as any)?.programType === 'SELF_DEFENSE' || (user as any)?.studentType === 'ADULT';

  return (
    <View style={st.logoContainer}>
      <View style={[st.badge, isAdult ? st.adultBadge : st.juniorBadge]}>
        <Ionicons name={isAdult ? 'fitness' : 'flash'} size={10} color="#FFF" />
        <Text style={st.badgeText}>{isAdult ? 'SELF-DEFENSE' : 'SPORT'}</Text>
      </View>
      <Text style={st.logoText}>ATAKA</Text>
    </View>
  );
}

/**
 * Header Right — [🔔] [Avatar]
 * Same structure as Owner: bell → notifications, avatar → profile
 */
function HeaderRight() {
  const router = useRouter();
  const user = useStore(s => s.user);
  const [unread, setUnread] = useState(0);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      try {
        const res = await api.get('/student/home');
        const data = res.data || res;
        const notifs = data?.notifications?.unread || 0;
        setUnread(notifs);
      } catch {}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []));

  return (
    <View style={st.headerRight}>
      {/* Bell → Notifications */}
      <Pressable
        testID="student-notifications-bell"
        onPress={() => router.push('/notifications' as any)}
        style={st.bellButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="notifications-outline" size={22} color="#1F2937" />
        {unread > 0 && (
          <View style={st.bellBadge}>
            <Text style={st.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>

      {/* Avatar → universal profile */}
      <Pressable
        testID="student-avatar"
        onPress={() => router.push('/profile' as any)}
        style={st.profileButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={st.avatarImage} />
        ) : (
          <View style={st.avatar}>
            <Text style={st.avatarText}>{user?.firstName?.[0]?.toUpperCase() || 'У'}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default function StudentLayout() {
  const user = useStore(s => s.user);
  const authState = useStore(s => s.authState);

  if (authState === 'loading' || authState === 'idle') {
    return <View style={st.center}><ActivityIndicator size="large" color={ACTIVE} /><Text style={st.loadingText}>Завантаження...</Text></View>;
  }
  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role !== 'STUDENT') {
    if (user.role === 'ADMIN') return <Redirect href="/(admin)" />;
    if (user.role === 'OWNER') return <Redirect href="/(owner)" />;
    if (user.role === 'COACH') return <Redirect href="/(coach)" />;
    return <Redirect href="/(tabs)" />;
  }

  const isAdult = (user as any)?.programType === 'SELF_DEFENSE' || (user as any)?.studentType === 'ADULT';
  const progressLabel = isAdult ? 'Підготовка' : 'Прогрес';

  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: ACTIVE,
      tabBarInactiveTintColor: INACTIVE,
      tabBarStyle: st.tabBar,
      tabBarLabelStyle: st.tabBarLabel,
      headerStyle: st.header,
      headerTitleStyle: st.headerTitle,
      headerTitleAlign: 'center' as const,
      headerShadowVisible: false,
      headerLeft: () => <HeaderLogo />,
      headerRight: () => <HeaderRight />,
      headerTitle: '',
    }}>
      <Tabs.Screen name="index" options={{ title: 'Головна', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Тренування', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="progress" options={{ title: progressLabel, tabBarIcon: ({ color, size }) => <Ionicons name={isAdult ? 'fitness' : 'trending-up'} size={size} color={color} /> }} />
      <Tabs.Screen name="feed" options={{ title: 'Активність', tabBarIcon: ({ color, size }) => <Ionicons name="newspaper" size={size} color={color} /> }} />
      <Tabs.Screen name="market" options={{ title: 'Маркет', tabBarIcon: ({ color, size }) => <Ionicons name="bag-handle" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  loadingText: { color: '#6B7280', marginTop: 12, fontSize: 14 },
  // Header
  header: { backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  logoContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  juniorBadge: { backgroundColor: '#E30613' },
  adultBadge: { backgroundColor: '#7C3AED' },
  badgeText: { color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  logoText: { fontSize: 18, fontWeight: '900', color: '#0F0F10', letterSpacing: 1 },
  // Header Right — same as Owner
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 4 },
  bellButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', position: 'relative' as const },
  bellBadge: { position: 'absolute' as const, top: 2, right: 0, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#E30613', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  bellBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  profileButton: { marginLeft: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E30613', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  avatarImage: { width: 28, height: 28, borderRadius: 14 },
  // Tab Bar
  tabBar: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F3F4F6', height: 58, paddingBottom: 6, paddingTop: 4 },
  tabBarLabel: { fontSize: 10, fontWeight: '600' },
});
