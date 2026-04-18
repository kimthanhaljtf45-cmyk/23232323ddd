import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  item: {
    _id: string;
    type: string;
    status: string;
    price: number;
    dateLabel: string;
    coachName: string;
    paid?: boolean;
  };
  onPress?: () => void;
};

export default function MyBookingCard({ item, onPress }: Props) {
  const typeLabels: Record<string, string> = {
    PERSONAL: 'Персональне тренування',
    TRIAL: 'Пробне заняття',
    CONSULTATION: 'Консультація',
  };

  const statusColors: Record<string, string> = {
    PENDING: '#FF9800',
    CONFIRMED: '#4CAF50',
    DONE: '#2E7D32',
    CANCELLED: '#F44336',
    NO_SHOW: '#F44336',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Очікує підтвердження',
    CONFIRMED: 'Підтверджено',
    DONE: 'Завершено',
    CANCELLED: 'Скасовано',
    NO_SHOW: 'Не з\'явився',
  };

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.type}>{typeLabels[item.type] || item.type}</Text>
        <View style={[styles.badge, { backgroundColor: statusColors[item.status] || '#999' }]}>
          <Text style={styles.badgeText}>{statusLabels[item.status] || item.status}</Text>
        </View>
      </View>
      
      <View style={styles.info}>
        <Ionicons name="person-outline" size={16} color="#666" />
        <Text style={styles.infoText}>{item.coachName}</Text>
      </View>
      
      <View style={styles.info}>
        <Ionicons name="calendar-outline" size={16} color="#666" />
        <Text style={styles.infoText}>{item.dateLabel}</Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.price}>{item.price} грн</Text>
        {item.paid !== undefined && (
          <View style={[styles.paidBadge, !item.paid && styles.unpaidBadge]}>
            <Ionicons 
              name={item.paid ? "checkmark-circle" : "close-circle"} 
              size={14} 
              color={item.paid ? "#2E7D32" : "#F44336"} 
            />
            <Text style={[styles.paidText, !item.paid && styles.unpaidText]}>
              {item.paid ? 'Оплачено' : 'Не оплачено'}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  type: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E53935',
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  unpaidBadge: {},
  paidText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
  },
  unpaidText: {
    color: '#F44336',
  },
});
