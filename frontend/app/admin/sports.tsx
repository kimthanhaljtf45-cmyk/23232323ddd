import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';

interface Sport {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  icon: string;
  attributes: Record<string, boolean>;
  marketplaceTags: string[];
  disciplines: string[];
  isActive: boolean;
}

const ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  shield: 'shield-outline',
  fitness: 'fitness-outline',
  flash: 'flash-outline',
  people: 'people-outline',
  star: 'star-outline',
  water: 'water-outline',
};

const CATEGORY_COLORS: Record<string, string> = {
  combat: '#EF4444',
  individual: '#3B82F6',
  team: '#10B981',
};

export default function AdminSportsScreen() {
  const router = useRouter();
  const [sports, setSports] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingSport, setEditingSport] = useState<Sport | null>(null);

  const fetchSports = async () => {
    try {
      const res = await api.get('/sports');
      setSports(res.data.sports || []);
    } catch (e) {
      console.error('Failed to fetch sports:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchSports(); }, []);

  const toggleSport = async (sportId: string, isActive: boolean) => {
    try {
      await api.put(`/sports/${sportId}`, { isActive: !isActive });
      fetchSports();
    } catch (e) {
      Alert.alert('Помилка', 'Не вдалося оновити');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Спорти</Text>
        <View style={styles.headerBadge}>
          <Text style={styles.headerBadgeText}>{sports.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSports(); }} tintColor="#E30613" />}
      >
        <Text style={styles.sectionTitle}>Config-driven система</Text>
        <Text style={styles.sectionSub}>Кожний спорт визначає поведінку платформи</Text>

        {sports.map((sport) => (
          <View key={sport.id} style={[styles.sportCard, !sport.isActive && styles.sportCardInactive]} testID={`sport-card-${sport.id}`}>
            <View style={styles.sportHeader}>
              <View style={[styles.sportIcon, { backgroundColor: CATEGORY_COLORS[sport.category] || '#6B7280' }]}>
                <Ionicons
                  name={ICON_MAP[sport.icon] || 'star-outline'}
                  size={24}
                  color="#FFF"
                />
              </View>
              <View style={styles.sportInfo}>
                <Text style={styles.sportName}>{sport.name}</Text>
                <Text style={styles.sportCategory}>{sport.category} · {sport.nameEn}</Text>
              </View>
              <TouchableOpacity
                testID={`toggle-sport-${sport.id}`}
                onPress={() => toggleSport(sport.id, sport.isActive)}
                style={[styles.toggleBtn, sport.isActive ? styles.toggleActive : styles.toggleInactive]}
              >
                <Text style={styles.toggleText}>{sport.isActive ? 'ON' : 'OFF'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sportDetails}>
              <View style={styles.attrRow}>
                <Text style={styles.attrLabel}>Атрибути:</Text>
                <View style={styles.tags}>
                  {Object.entries(sport.attributes || {}).filter(([, v]) => v).map(([k]) => (
                    <View key={k} style={styles.attrTag}>
                      <Text style={styles.attrTagText}>{k}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.attrRow}>
                <Text style={styles.attrLabel}>Marketplace:</Text>
                <View style={styles.tags}>
                  {(sport.marketplaceTags || []).map((tag) => (
                    <View key={tag} style={styles.marketTag}>
                      <Text style={styles.marketTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.attrRow}>
                <Text style={styles.attrLabel}>Дисципліни:</Text>
                <Text style={styles.attrValue}>{(sport.disciplines || []).join(', ')}</Text>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F10' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1F1F23' },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: '#FFF', marginLeft: 12 },
  headerBadge: { backgroundColor: '#E30613', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
  headerBadgeText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginTop: 20 },
  sectionSub: { fontSize: 13, color: '#9CA3AF', marginTop: 4, marginBottom: 16 },
  sportCard: { backgroundColor: '#1A1A1E', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#2A2A30' },
  sportCardInactive: { opacity: 0.5 },
  sportHeader: { flexDirection: 'row', alignItems: 'center' },
  sportIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sportInfo: { flex: 1, marginLeft: 12 },
  sportName: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  sportCategory: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  toggleBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  toggleActive: { backgroundColor: '#10B981' },
  toggleInactive: { backgroundColor: '#4B5563' },
  toggleText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  sportDetails: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#2A2A30' },
  attrRow: { marginBottom: 10 },
  attrLabel: { fontSize: 12, color: '#9CA3AF', marginBottom: 4 },
  attrValue: { fontSize: 14, color: '#E5E7EB' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  attrTag: { backgroundColor: '#374151', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  attrTagText: { color: '#D1D5DB', fontSize: 12 },
  marketTag: { backgroundColor: '#1E3A5F', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  marketTagText: { color: '#93C5FD', fontSize: 12 },
});
