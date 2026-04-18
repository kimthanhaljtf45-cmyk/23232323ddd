import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../../src/store/useStore';
import { api } from '../../src/lib/api';

export default function StudentProfile() {
  const user = useStore(s => s.user);
  const logout = useStore(s => s.logout);
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [gamification, setGamification] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [homeRes, gamRes] = await Promise.allSettled([api.get('/student/home'), api.get('/student/gamification')]);
      if (homeRes.status === 'fulfilled') setData(homeRes.value.data || homeRes.value);
      if (gamRes.status === 'fulfilled') setGamification(gamRes.value.data || gamRes.value);
    } catch {}
    finally { setLoading(false); }
  };
  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleLogout = () => {
    Alert.alert('Вийти?', '', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Вийти', style: 'destructive', onPress: async () => {
        try { await api.post('/auth/logout'); } catch {} logout(); router.replace('/(auth)/welcome' as any);
      }},
    ]);
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const g = gamification || data?.gamification || {};
  const stats = data?.stats || {};
  const sub = data?.subscription;
  const isAdult = (data?.student?.studentType || 'JUNIOR') === 'ADULT';
  const accent = isAdult ? '#7C3AED' : '#E30613';
  const badges = (g.badges || []).filter((b: any) => b.earned);

  return (
    <ScrollView style={s.container}>
      <Text style={s.title}>Профіль</Text>

      {/* Identity Hero */}
      <View style={s.heroCard} testID="profile-identity">
        <View style={[s.avatar, { backgroundColor: accent }]}>
          <Text style={s.avatarText}>{user?.firstName?.[0]?.toUpperCase() || 'У'}</Text>
        </View>
        <Text style={s.name}>{user?.firstName || ''} {user?.lastName || ''}</Text>
        <View style={[s.trackTag, { backgroundColor: accent + '15' }]}>
          <Text style={[s.trackText, { color: accent }]}>{isAdult ? 'САМООБОРОНА' : 'СПОРТ'}</Text>
        </View>

        {/* Level & XP — ЦЕНТР */}
        <View style={s.levelSection}>
          <View style={s.levelBadge}><Text style={s.levelText}>Lv.{g.level || 0}</Text></View>
          <Text style={s.levelName}>{g.levelName || 'Новачок'}</Text>
        </View>
        <View style={s.xpRow}>
          <Text style={s.xpLabel}>XP</Text>
          <View style={s.xpBarBg}><View style={[s.xpBarFill, { width: `${g.xpProgress || 0}%` }]} /></View>
          <Text style={s.xpVal}>{g.xp || 0}</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={s.card} testID="profile-badges">
        <View style={s.cardHeader}>
          <Ionicons name="ribbon" size={18} color="#F59E0B" />
          <Text style={s.cardTitle}>Бейджі</Text>
          <Text style={s.cardCount}>{badges.length}</Text>
        </View>
        {badges.length > 0 ? (
          <View style={s.badgesRow}>
            {badges.map((b: any, i: number) => (
              <View key={i} style={s.badgeItem} testID={`badge-${b.id}`}>
                <View style={s.badgeCircle}><Ionicons name={b.icon || 'star'} size={20} color="#F59E0B" /></View>
                <Text style={s.badgeName} numberOfLines={2}>{b.name}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.emptyText}>Тренуйтесь щоб отримати бейджі</Text>
        )}
      </View>

      {/* Stats */}
      <View style={s.card} testID="profile-stats">
        <View style={s.cardHeader}>
          <Ionicons name="analytics" size={18} color="#3B82F6" />
          <Text style={s.cardTitle}>Статистика</Text>
        </View>
        <View style={s.statsGrid}>
          <View style={s.statItem}><Text style={s.statVal}>{stats.attendanceRate || 0}%</Text><Text style={s.statLabel}>Відвідуваність</Text></View>
          <View style={s.statItem}><Text style={s.statVal}>{stats.totalTrainings || 0}</Text><Text style={s.statLabel}>Тренувань</Text></View>
          <View style={s.statItem}><Text style={s.statVal}>{stats.streak || 0}</Text><Text style={s.statLabel}>Серія</Text></View>
        </View>
      </View>

      {/* Subscription */}
      {sub && (
        <View style={s.card} testID="profile-sub">
          <View style={s.cardHeader}>
            <Ionicons name="card" size={18} color="#10B981" />
            <Text style={s.cardTitle}>Абонемент</Text>
          </View>
          <View style={s.subRow}>
            <View>
              <Text style={s.subPlan}>{sub.planName}</Text>
              <Text style={s.subStatus}>{sub.status === 'ACTIVE' ? '✅ Активний' : sub.status}{sub.daysLeft ? ` · ${sub.daysLeft} дн` : ''}</Text>
            </View>
            <Text style={s.subPrice}>{sub.price} ₴</Text>
          </View>
        </View>
      )}

      {/* Finance */}
      <View style={s.card} testID="profile-finance">
        <View style={s.cardHeader}>
          <Ionicons name="wallet" size={18} color="#6B7280" />
          <Text style={s.cardTitle}>Фінанси</Text>
        </View>
        <View style={s.finRow}>
          <Text style={s.finLabel}>Борг:</Text>
          <Text style={[s.finVal, stats.debt > 0 && { color: '#EF4444' }]}>{stats.debt || 0} ₴</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity testID="logout-btn" style={s.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={s.logoutText}>Вийти з акаунту</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  title: { fontSize: 24, fontWeight: '800', color: '#0F0F10', marginTop: 16, marginBottom: 12 },
  // Hero
  heroCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#F3F4F6' },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  trackTag: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  trackText: { fontSize: 12, fontWeight: '700' },
  levelSection: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  levelBadge: { backgroundColor: '#F59E0B', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  levelText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  levelName: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: 10 },
  xpLabel: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  xpBarBg: { flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  xpBarFill: { height: 8, backgroundColor: '#F59E0B', borderRadius: 4 },
  xpVal: { fontSize: 14, fontWeight: '800', color: '#F59E0B', width: 40, textAlign: 'right' },
  // Card
  card: { backgroundColor: '#FFF', borderRadius: 18, padding: 18, marginTop: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#374151' },
  cardCount: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  // Badges
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  badgeItem: { alignItems: 'center', width: 70 },
  badgeCircle: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FDE68A' },
  badgeName: { fontSize: 11, color: '#374151', textAlign: 'center', marginTop: 4 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 8 },
  // Stats
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  // Sub
  subRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subPlan: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  subStatus: { fontSize: 13, color: '#10B981', fontWeight: '600', marginTop: 2 },
  subPrice: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  // Finance
  finRow: { flexDirection: 'row', justifyContent: 'space-between' },
  finLabel: { fontSize: 15, color: '#6B7280' },
  finVal: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  // Logout
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#FECACA' },
  logoutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
});
