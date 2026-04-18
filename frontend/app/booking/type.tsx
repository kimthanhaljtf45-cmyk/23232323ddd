import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CoachCard from '../../src/components/booking/CoachCard';
import axios from 'axios';
import { API_URL } from '../../src/constants';

export default function BookingTypeScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const typeLabels: Record<string, string> = {
    PERSONAL: 'Персональне тренування',
    TRIAL: 'Пробне заняття',
    CONSULTATION: 'Консультація',
  };

  useEffect(() => {
    loadCoaches();
  }, [type]);

  const loadCoaches = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/booking/coaches?type=${type}`);
      setCoaches(res.data || []);
    } catch (error) {
      console.error('Error loading coaches:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.title}>Оберіть тренера</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.subtitle}>
        {typeLabels[type || ''] || type}
      </Text>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E53935" />
        </View>
      ) : coaches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={48} color="#CCC" />
          <Text style={styles.emptyText}>Тренерів не знайдено</Text>
        </View>
      ) : (
        <FlatList
          data={coaches}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <CoachCard
              coach={item}
              onPress={() =>
                router.push({
                  pathname: '/booking/coach/[id]',
                  params: { id: item._id, type, coachName: item.name, price: item.price },
                })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  list: { padding: 16, paddingTop: 0 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16, color: '#999' },
});
