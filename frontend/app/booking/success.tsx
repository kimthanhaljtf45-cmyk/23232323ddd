import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function BookingSuccessScreen() {
  const params = useLocalSearchParams<{
    coachName: string;
    date: string;
    time: string;
    type: string;
  }>();
  const router = useRouter();

  const typeLabels: Record<string, string> = {
    PERSONAL: 'Персональне тренування',
    TRIAL: 'Пробне заняття',
    CONSULTATION: 'Консультація',
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
        </View>

        <Text style={styles.title}>Запис підтверджено!</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="fitness-outline" size={20} color="#666" />
            <Text style={styles.rowText}>
              {typeLabels[params.type || ''] || params.type}
            </Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="person-outline" size={20} color="#666" />
            <Text style={styles.rowText}>Тренер: {params.coachName}</Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.rowText}>{params.date}</Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.rowText}>{params.time}</Text>
          </View>
        </View>

        <Text style={styles.hint}>
          Тренер отримав сповіщення про ваш запис
        </Text>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => router.replace('/booking/my')}
          style={styles.myBookingsButton}
        >
          <Text style={styles.myBookingsButtonText}>
            Мої бронювання
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={styles.homeButton}
        >
          <Text style={styles.homeButtonText}>
            На головну
          </Text>
        </Pressable>
      </View>
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
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#333',
  },
  hint: {
    marginTop: 20,
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  footer: {
    padding: 16,
  },
  myBookingsButton: {
    backgroundColor: '#E53935',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  myBookingsButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  homeButton: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  homeButtonText: {
    color: '#111',
    fontSize: 16,
    fontWeight: '600',
  },
});
