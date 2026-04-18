import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SlotButton from '../../../src/components/booking/SlotButton';
import axios from 'axios';
import { API_URL } from '../../../src/constants';

export default function BookingCoachScreen() {
  const { id, type, coachName, price } = useLocalSearchParams<{
    id: string;
    type: string;
    coachName: string;
    price: string;
  }>();
  
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [dates, setDates] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    const nextDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      nextDays.push(d.toISOString().split('T')[0]);
    }
    setDates(nextDays);
    setSelectedDate(nextDays[0]);
  }, []);

  useEffect(() => {
    if (selectedDate && id) {
      loadSlots();
    }
  }, [selectedDate, id]);

  const loadSlots = async () => {
    setLoading(true);
    setSelectedSlot(null);
    try {
      const res = await axios.get(`${API_URL}/api/booking/slots?coachId=${id}&date=${selectedDate}&type=${type}`);
      setSlots(res.data || []);
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return { day: date.getDate(), weekday: days[date.getDay()] };
  };

  const handleContinue = () => {
    if (!selectedSlot) return;
    router.push({
      pathname: '/booking/confirm',
      params: {
        coachId: id,
        coachName: coachName,
        type,
        slotId: selectedSlot._id,
        date: selectedDate,
        time: selectedSlot.startTime,
        price: price || '800',
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.title}>{coachName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Оберіть дату</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.datesContainer}>
          {dates.map((date) => {
            const { day, weekday } = formatDate(date);
            const isSelected = date === selectedDate;
            return (
              <Pressable key={date} onPress={() => setSelectedDate(date)} style={[styles.dateButton, isSelected && styles.dateButtonActive]}>
                <Text style={[styles.weekday, isSelected && styles.weekdayActive]}>{weekday}</Text>
                <Text style={[styles.day, isSelected && styles.dayActive]}>{day}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.sectionTitle}>Оберіть час</Text>
        {loading ? (
          <ActivityIndicator size="large" color="#E53935" style={{ marginTop: 20 }} />
        ) : slots.length === 0 ? (
          <View style={styles.noSlots}>
            <Ionicons name="calendar-outline" size={32} color="#CCC" />
            <Text style={styles.noSlotsText}>Немає доступних слотів</Text>
          </View>
        ) : (
          <View style={styles.slotsContainer}>
            {slots.map((slot) => (
              <SlotButton
                key={slot._id}
                label={slot.startTime}
                active={selectedSlot?._id === slot._id}
                disabled={slot.status !== 'AVAILABLE'}
                onPress={() => setSelectedSlot(slot)}
              />
            ))}
          </View>
        )}

        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Вартість:</Text>
            <Text style={styles.priceValue}>{price || 800} грн</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Тривалість:</Text>
            <Text style={styles.priceValue}>60 хв</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable disabled={!selectedSlot} onPress={handleContinue} style={[styles.continueButton, !selectedSlot && styles.continueButtonDisabled]}>
          <Text style={styles.continueButtonText}>Продовжити</Text>
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
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 12 },
  datesContainer: { paddingBottom: 16, marginBottom: 8 },
  dateButton: { width: 56, height: 72, borderRadius: 12, backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center', marginRight: 8, borderWidth: 1, borderColor: '#E5E5E5' },
  dateButtonActive: { backgroundColor: '#E53935', borderColor: '#E53935' },
  weekday: { fontSize: 12, color: '#666', marginBottom: 4 },
  weekdayActive: { color: '#FFF' },
  day: { fontSize: 18, fontWeight: '700', color: '#111' },
  dayActive: { color: '#FFF' },
  slotsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  noSlots: { alignItems: 'center', padding: 32 },
  noSlotsText: { marginTop: 8, fontSize: 14, color: '#999' },
  priceCard: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  priceLabel: { fontSize: 14, color: '#666' },
  priceValue: { fontSize: 14, fontWeight: '600', color: '#111' },
  footer: { padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  continueButton: { backgroundColor: '#E53935', padding: 16, borderRadius: 14, alignItems: 'center' },
  continueButtonDisabled: { backgroundColor: '#F3B3AE' },
  continueButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
