import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  typeLabel: string;
  coachName: string;
  date: string;
  time: string;
  price: number;
};

export default function BookingSummaryCard({
  typeLabel,
  coachName,
  date,
  time,
  price,
}: Props) {
  const typeLabels: Record<string, string> = {
    PERSONAL: 'Персональне тренування',
    TRIAL: 'Пробне заняття',
    CONSULTATION: 'Консультація',
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="calendar" size={24} color="#FFF" />
        <Text style={styles.headerText}>Підтвердження запису</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Тип</Text>
        <Text style={styles.value}>{typeLabels[typeLabel] || typeLabel}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Тренер</Text>
        <Text style={styles.value}>{coachName}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Дата</Text>
        <Text style={styles.value}>{date}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Час</Text>
        <Text style={styles.value}>{time}</Text>
      </View>

      <View style={[styles.row, styles.priceRow]}>
        <Text style={styles.label}>Вартість</Text>
        <Text style={styles.price}>{price} грн</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  priceRow: {
    borderBottomWidth: 0,
    marginTop: 8,
  },
  label: {
    color: '#999',
    fontSize: 14,
  },
  value: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  price: {
    color: '#FF8A80',
    fontSize: 18,
    fontWeight: '700',
  },
});
