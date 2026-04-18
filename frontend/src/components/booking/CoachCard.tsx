import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  coach: {
    _id: string;
    name: string;
    subtitle?: string;
    price?: number;
  };
  onPress: () => void;
};

export default function CoachCard({ coach, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color="#E53935" />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{coach.name}</Text>
        {!!coach.subtitle && (
          <Text style={styles.subtitle}>{coach.subtitle}</Text>
        )}
        {!!coach.price && (
          <Text style={styles.price}>{coach.price} грн / заняття</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
  price: {
    marginTop: 6,
    fontSize: 14,
    color: '#E53935',
    fontWeight: '600',
  },
});
