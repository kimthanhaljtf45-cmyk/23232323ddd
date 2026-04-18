import React from 'react';
import { Text, View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BookingTypeCard from '../../src/components/booking/BookingTypeCard';

export default function BookingHomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111" />
          </Pressable>
          <Text style={styles.title}>Бронювання</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.subtitle}>
          Оберіть формат заняття
        </Text>

        <View style={styles.cards}>
          <BookingTypeCard
            title="Персональне тренування"
            subtitle="Індивідуальна робота 1:1 з тренером"
            icon="fitness"
            onPress={() => router.push('/booking/type?type=PERSONAL')}
          />

          <BookingTypeCard
            title="Пробне заняття"
            subtitle="Знайомство з тренером та форматом занять"
            icon="star"
            onPress={() => router.push('/booking/type?type=TRIAL')}
          />

          <BookingTypeCard
            title="Консультація"
            subtitle="Підбір формату, навантаження та програми"
            icon="chatbubbles"
            onPress={() => router.push('/booking/type?type=CONSULTATION')}
          />
        </View>

        <Pressable
          style={styles.myBookingsButton}
          onPress={() => router.push('/booking/my')}
        >
          <Ionicons name="list" size={20} color="#E53935" />
          <Text style={styles.myBookingsText}>Мої бронювання</Text>
          <Ionicons name="chevron-forward" size={20} color="#E53935" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  cards: {
    marginBottom: 24,
  },
  myBookingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  myBookingsText: {
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#E53935',
  },
});
