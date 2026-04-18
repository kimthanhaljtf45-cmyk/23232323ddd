import { Stack, useRouter } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store/useStore';

type MenuItem = {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  badge?: number;
};

const menuSections = [
  {
    title: 'Фінанси',
    items: [
      { title: 'Billing', icon: 'card-outline', route: '/admin/billing' },
      { title: 'Підписки', icon: 'refresh-outline', route: '/admin/subscriptions' },
      { title: 'Тарифи', icon: 'pricetag-outline', route: '/admin/pricing' },
    ] as MenuItem[],
  },
  {
    title: 'Продажі',
    items: [
      { title: 'Leads', icon: 'people-outline', route: '/admin/leads' },
    ] as MenuItem[],
  },
];

export default function AdminLayout() {
  const router = useRouter();
  const user = useStore((state) => state.user);

  // Check access: OWNER and ADMIN both have full operational control
  // OWNER = франчайзі, повний контроль над своїм клубом/філіалами
  // ADMIN = платформа (supervisor)
  const allowedRoles = ['ADMIN', 'OWNER'];
  if (!user?.role || !allowedRoles.includes(user.role)) {
    return (
      <SafeAreaView style={styles.accessDenied}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="lock-closed" size={48} color="#EF4444" />
        <Text style={styles.accessDeniedTitle}>Доступ заборонено</Text>
        <Text style={styles.accessDeniedText}>Тільки для адміністраторів та власників</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Назад</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#F9FAFB' },
      }}
    />
  );
}

const styles = StyleSheet.create({
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 24,
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F0F10',
    marginTop: 16,
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  backBtn: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#E30613',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
