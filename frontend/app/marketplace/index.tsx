import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type MarketplaceGroup = {
  id: string;
  name: string;
  programType: string;
  coach: { id: string; firstName: string; lastName: string };
  location?: { id: string; name: string; address?: string };
  rating: number;
  fillRate: number;
  studentsCount: number;
  capacity: number;
  status: 'FULL' | 'LAST_SPOTS' | 'AVAILABLE';
  schedule: Array<{ day: string; time: string }>;
  ageRange?: string;
  level?: string;
  monthlyPrice: number;
  badges: string[];
};

const BADGE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  TOP_COACH: { icon: 'trophy', label: 'Топ тренер', color: '#F59E0B' },
  POPULAR: { icon: 'flame', label: 'Популярна', color: '#DC2626' },
  FULL: { icon: 'close-circle', label: 'Заповнена', color: '#6B7280' },
  NEW_GROUP: { icon: 'sparkles', label: 'Нова', color: '#3B82F6' },
  PROMOTED: { icon: 'star', label: 'Рекомендовано', color: '#8B5CF6' },
};

const PROGRAM_LABELS: Record<string, string> = {
  KIDS: 'Дитяча',
  SPECIAL: 'Особлива',
  SELF_DEFENSE: 'Самооборона',
  MENTORSHIP: 'Менторство',
  CONSULTATION: 'Консультація',
};

const DAY_LABELS: Record<string, string> = {
  MON: 'Пн', TUE: 'Вт', WED: 'Ср', THU: 'Чт', FRI: 'Пт', SAT: 'Сб', SUN: 'Нд',
};

export default function MarketplaceScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<string | null>(null);

  const { data: groups = [], isLoading, refetch } = useQuery<MarketplaceGroup[]>({
    queryKey: ['marketplace-groups', filter],
    queryFn: () => {
      const params = filter ? `?programType=${filter}` : '';
      return api.get(`/marketplace/groups${params}`);
    },
  });

  const spotsLeft = (g: MarketplaceGroup) => g.capacity - g.studentsCount;

  const renderGroupCard = (group: MarketplaceGroup) => {
    const isFull = group.status === 'FULL';
    const isLastSpots = group.status === 'LAST_SPOTS';

    return (
      <TouchableOpacity
        key={group.id}
        testID={`marketplace-group-${group.id}`}
        style={[styles.groupCard, isFull && styles.groupCardFull]}
        activeOpacity={isFull ? 1 : 0.7}
        onPress={() => {
          if (!isFull) {
            Alert.alert(
              group.name,
              `Тренер: ${group.coach.firstName} ${group.coach.lastName}\nЦіна: ${group.monthlyPrice} грн/міс\nМісць: ${spotsLeft(group)}/${group.capacity}\n\nЗаписати дитину?`,
              [
                { text: 'Скасувати', style: 'cancel' },
                { text: 'Записатися', onPress: () => Alert.alert('Успіх', 'Зверніться до адміністратора для запису') },
              ],
            );
          }
        }}
      >
        {/* Badges */}
        {group.badges.length > 0 && (
          <View style={styles.badgesRow}>
            {group.badges.map((badge, i) => {
              const config = BADGE_CONFIG[badge];
              if (!config) return null;
              return (
                <View key={i} style={[styles.badge, { backgroundColor: config.color + '20', borderColor: config.color + '40' }]}>
                  <Ionicons name={config.icon as any} size={10} color={config.color} />
                  <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.groupMain}>
          <View style={styles.groupInfo}>
            <Text style={[styles.groupName, isFull && styles.textMuted]}>{group.name}</Text>
            <View style={styles.coachRow}>
              <Ionicons name="person" size={14} color="#A1A1AA" />
              <Text style={styles.coachName}>{group.coach.firstName} {group.coach.lastName}</Text>
            </View>
            {group.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#A1A1AA" />
                <Text style={styles.locationText}>{group.location.name}</Text>
              </View>
            )}
          </View>

          {/* Rating Circle */}
          <View style={[styles.ratingCircle, { borderColor: group.rating >= 70 ? '#16A34A' : group.rating >= 50 ? '#F59E0B' : '#6B7280' }]}>
            <Text style={styles.ratingValue}>{group.rating}</Text>
            <Text style={styles.ratingLabel}>Рейтинг</Text>
          </View>
        </View>

        {/* Schedule */}
        {group.schedule.length > 0 && (
          <View style={styles.scheduleRow}>
            <Ionicons name="calendar-outline" size={14} color="#71717A" />
            <Text style={styles.scheduleText}>
              {group.schedule.map(s => `${DAY_LABELS[s.day] || s.day} ${s.time}`).join(' | ')}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.groupFooter}>
          <View style={styles.fillBar}>
            <View style={[styles.fillBarInner, { width: `${Math.min(group.fillRate, 100)}%`, backgroundColor: isFull ? '#6B7280' : isLastSpots ? '#F59E0B' : '#16A34A' }]} />
          </View>
          <View style={styles.footerInfo}>
            <Text style={styles.priceText}>{group.monthlyPrice} грн/міс</Text>
            {isFull ? (
              <Text style={styles.fullText}>ЗАПОВНЕНА</Text>
            ) : isLastSpots ? (
              <Text style={styles.lastSpotsText}>Залишилось {spotsLeft(group)} місць!</Text>
            ) : (
              <Text style={styles.availableText}>{spotsLeft(group)} місць</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { key: null, label: 'Всі' },
    { key: 'KIDS', label: 'Дитяча' },
    { key: 'SELF_DEFENSE', label: 'Самооборона' },
    { key: 'SPECIAL', label: 'Особлива' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FAFAFA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Обрати секцію</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
        {filters.map(f => (
          <TouchableOpacity
            key={f.key || 'all'}
            testID={`filter-${f.key || 'all'}`}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#DC2626" />}
      >
        {isLoading ? (
          <ActivityIndicator color="#DC2626" style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={56} color="#3F3F46" />
            <Text style={styles.emptyTitle}>Групи не знайдено</Text>
          </View>
        ) : (
          <>
            <Text style={styles.resultsCount}>{groups.length} груп доступно</Text>
            {groups.map(renderGroupCard)}
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FAFAFA', letterSpacing: 0.5, textTransform: 'uppercase' },
  filtersScroll: { maxHeight: 52 },
  filtersContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#18181B', borderWidth: 1, borderColor: '#27272A' },
  filterChipActive: { backgroundColor: '#DC262620', borderColor: '#DC2626' },
  filterChipText: { fontSize: 13, color: '#A1A1AA', fontWeight: '600' },
  filterChipTextActive: { color: '#DC2626' },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  resultsCount: { fontSize: 12, color: '#71717A', marginTop: 8, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  // Group Card
  groupCard: { backgroundColor: '#18181B', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272A' },
  groupCardFull: { opacity: 0.5 },
  badgesRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  groupMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 18, fontWeight: '700', color: '#FAFAFA', marginBottom: 6 },
  textMuted: { color: '#71717A' },
  coachRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  coachName: { fontSize: 13, color: '#A1A1AA' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  locationText: { fontSize: 13, color: '#71717A' },
  ratingCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  ratingValue: { fontSize: 18, fontWeight: '900', color: '#FAFAFA' },
  ratingLabel: { fontSize: 8, color: '#71717A', textTransform: 'uppercase', letterSpacing: 0.5 },
  scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#27272A' },
  scheduleText: { fontSize: 12, color: '#71717A' },
  groupFooter: { marginTop: 12 },
  fillBar: { height: 4, backgroundColor: '#27272A', borderRadius: 2, overflow: 'hidden' },
  fillBarInner: { height: '100%', borderRadius: 2 },
  footerInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  priceText: { fontSize: 14, fontWeight: '700', color: '#FAFAFA' },
  fullText: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  lastSpotsText: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
  availableText: { fontSize: 12, color: '#16A34A', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, color: '#52525B', marginTop: 12 },
});
