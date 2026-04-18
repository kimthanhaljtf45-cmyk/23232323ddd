import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';

interface Props {
  title: string;
  description: string;
  discountLabel?: string;
  onPress?: () => void;
}

export default function ParentOfferCard({
  title,
  description,
  discountLabel,
  onPress,
}: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.title}>{title}</Text>

      <Text style={styles.description}>
        {description}
      </Text>

      {!!discountLabel && (
        <Text style={styles.discount}>
          {discountLabel}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 18,
    padding: 18,
    marginTop: 12,
  },
  title: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 16,
  },
  description: {
    color: '#DDD',
    marginTop: 8,
    lineHeight: 20,
  },
  discount: {
    color: '#FF8A80',
    marginTop: 10,
    fontWeight: '700',
  },
});
