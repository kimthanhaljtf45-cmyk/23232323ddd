import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, Text, View, StyleSheet, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MyBookingCard from '../../src/components/booking/MyBookingCard';
import api from '../../src/lib/api';

export default function MyBookingsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => { loadBookings(); }, []);

  const loadBookings = async () => {
    try {
      const res = await api.get('/booking/my');
      setItems(res.data || []);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => { setRefreshing(true); loadBookings(); }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.title}>Мої бронювання</Text>
        <Pressable onPress={() => router.push('/booking')} style={styles.addButton}>
          <Ionicons name="add" size={24} color="#E53935" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#E53935" /></View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>Бронювань немає</Text>
          <Text style={styles.emptyText}>Запишіться на персональне тренування</Text>
          <Pressable style={styles.newBookingButton} onPress={() => router.push('/booking')}>
            <Ionicons name="add" size={20} color="#FFF" />
            <Text style={styles.newBookingButtonText}>Нове бронювання</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => <MyBookingCard item={item} />}
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
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { marginTop: 16, fontSize: 18, fontWeight: '700', color: '#111' },
  emptyText: { marginTop: 8, fontSize: 14, color: '#666', textAlign: 'center' },
  newBookingButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E53935', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, marginTop: 24 },
  newBookingButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
