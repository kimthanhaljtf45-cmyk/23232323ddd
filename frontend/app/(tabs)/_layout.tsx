import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/store/useStore';
import { View, Text, StyleSheet, Platform, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';

const ACTIVE = '#E30613';
const INACTIVE = '#9CA3AF';

function HeaderLogo() {
  return (
    <View style={styles.logoWrap}>
      <Text style={styles.logoIcon}>🥋</Text>
      <Text style={styles.logoText}>АТАКА</Text>
    </View>
  );
}

function HeaderRight() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  return (
    <View style={styles.headerRight}>
      <Pressable testID="notif-btn" onPress={() => router.push('/notifications' as any)} hitSlop={10} style={styles.iconBtn}>
        <Ionicons name="notifications-outline" size={22} color="#374151" />
      </Pressable>
      <Pressable testID="profile-btn" onPress={() => router.push('/(tabs)/profile' as any)} hitSlop={10} style={styles.avatarBtn}>
        {user?.avatarUrl ? (
          <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.firstName?.[0]?.toUpperCase() || 'У'}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

export default function TabsLayout() {
  const cartCount = useStore((s) => s.cartItemsCount || 0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerLeft: () => <HeaderLogo />,
        headerRight: () => <HeaderRight />,
        headerTitle: '',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Головна',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Розклад',
          tabBarIcon: ({ color }) => <Ionicons name="calendar" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Прогрес',
          tabBarIcon: ({ color }) => <Ionicons name="trending-up" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Стрічка',
          tabBarIcon: ({ color }) => <Ionicons name="newspaper" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Магазин',
          tabBarIcon: ({ color }) => (
            <View>
              <Ionicons name="cart" size={22} color={color} />
              {cartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cartCount > 9 ? '9+' : cartCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      {/* Profile hidden from tabs — accessed via header avatar */}
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopColor: '#F3F4F6',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 6,
    height: Platform.OS === 'ios' ? 88 : 64,
  },
  tabLabel: { fontSize: 10, fontWeight: '600' },
  header: {
    backgroundColor: '#fff',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    height: Platform.OS === 'ios' ? 100 : 60,
  },
  logoWrap: { flexDirection: 'row', alignItems: 'center', marginLeft: 16, gap: 6 },
  logoIcon: { fontSize: 20 },
  logoText: { fontSize: 17, fontWeight: '800', color: '#0F0F10', letterSpacing: -0.5 },
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 12 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  avatarBtn: {},
  avatarImg: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: '#F3F4F6' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E30613', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  badge: { position: 'absolute', right: -8, top: -4, backgroundColor: '#E30613', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
