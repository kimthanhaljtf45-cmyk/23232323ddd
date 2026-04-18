import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image, Pressable } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useStore } from '../../src/store/useStore';

const ACTIVE_COLOR = '#7C3AED'; // Purple for Admin
const INACTIVE_COLOR = '#9CA3AF';

/**
 * COMPACT Header Logo
 */
function HeaderLogo() {
  return (
    <View style={styles.logoContainer}>
      <Text style={styles.logoIcon}>🥋</Text>
      <Text style={styles.logoText}>ATAKA</Text>
    </View>
  );
}

/**
 * COMPACT Header Avatar
 */
function HeaderAvatar() {
  const router = useRouter();
  const user = useStore((state) => state.user);
  
  return (
    <Pressable
      onPress={() => router.push('/admin/profile')}
      style={styles.profileButton}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {user?.avatarUrl ? (
        <Image 
          key={user.avatarUrl}
          source={{ uri: user.avatarUrl }} 
          style={styles.avatarImage}
        />
      ) : (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.firstName?.[0]?.toUpperCase() || 'A'}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/**
 * ADMIN APP LAYOUT - Compact & Clean
 */
export default function AdminTabLayout() {
  const router = useRouter();
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

  if (user.role !== 'ADMIN') {
    if (user.role === 'COACH') {
      return <Redirect href="/(coach)" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        headerStyle: styles.header,
        headerTitleStyle: styles.headerTitle,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerLeft: () => <HeaderLogo />,
        headerRight: () => <HeaderAvatar />,
        headerTitle: '',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Огляд',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="finance"
        options={{
          title: 'Фінанси',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="wallet" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Групи',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'Люди',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="club"
        options={{
          title: 'Клуб',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
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
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    height: 80,
    paddingBottom: 22,
    paddingTop: 8,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  // COMPACT HEADER - 56px max
  header: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    height: 56,
  },
  headerTitle: {
    fontWeight: '800',
    fontSize: 18,
    color: '#0F0F10',
  },
  // COMPACT LOGO
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
    gap: 6,
  },
  logoIcon: {
    fontSize: 20,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F0F10',
    letterSpacing: -0.5,
  },
  // COMPACT AVATAR
  profileButton: {
    marginRight: 16,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  avatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
