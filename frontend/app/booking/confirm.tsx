import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BookingSummaryCard from '../../src/components/booking/BookingSummaryCard';
import api from '../../src/lib/api';
import { useStore } from '../../src/store/useStore';

export default function BookingConfirmScreen() {
  const params = useLocalSearchParams<{
    coachId: string;
    coachName: string;
    type: string;
    slotId: string;
    date: string;
    time: string;
    price: string;
  }>();

  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const user = useStore((s) => s.user);

  const handleConfirm = async () => {
    if (!user) {
      Alert.alert('Увага', 'Будь ласка, увійдіть в систему');
      return;
    }

    setLoading(true);
    try {
      await api.post('/booking', {
        coachId: params.coachId,
        slotId: params.slotId,
        type: params.type,
      });

      router.replace({
        pathname: '/booking/success',
        params: {
          coachName: params.coachName,
          date: params.date,
          time: params.time,
          type: params.type,
        },
      });
    } catch (error: any) {
      console.error('Booking error:', error);
      Alert.alert('Помилка', error.response?.data?.message || 'Не вдалося створити бронювання');
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
        <Text style={styles.title}>Підтвердження</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <BookingSummaryCard
          typeLabel={params.type || ''}
          coachName={params.coachName || ''}
          date={params.date || ''}
          time={params.time || ''}
          price={Number(params.price || 0)}
        />

        <View style={styles.notice}>
          <Ionicons name="information-circle" size={20} color="#666" />
          <Text style={styles.noticeText}>
            Після підтвердження тренер отримає сповіщення та підтвердить запис
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable onPress={handleConfirm} disabled={loading} style={[styles.confirmButton, loading && styles.confirmButtonDisabled]}>
          {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.confirmButtonText}>Підтвердити запис</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  content: { flex: 1, padding: 16 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, padding: 12, backgroundColor: '#F5F5F5', borderRadius: 12 },
  noticeText: { flex: 1, marginLeft: 8, fontSize: 13, color: '#666', lineHeight: 18 },
  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  confirmButton: { backgroundColor: '#E53935', padding: 16, borderRadius: 14, alignItems: 'center' },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
