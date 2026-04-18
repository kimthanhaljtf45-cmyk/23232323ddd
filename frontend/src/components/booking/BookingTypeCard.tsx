import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress: () => void;
};

export default function BookingTypeCard({
  title,
  subtitle,
  icon,
  active,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        active && styles.cardActive,
      ]}
    >
      <View style={styles.iconContainer}>
        <Ionicons
          name={icon}
          size={24}
          color={active ? '#FFF' : '#E53935'}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, active && styles.titleActive]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, active && styles.subtitleActive]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={active ? '#FFF' : '#999'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
    marginBottom: 12,
  },
  cardActive: {
    borderColor: '#111',
    backgroundColor: '#111',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  titleActive: {
    color: '#FFF',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },
  subtitleActive: {
    color: '#DDD',
  },
});
