import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { format, parseISO, differenceInHours } from 'date-fns';
import { uk } from 'date-fns/locale';

interface MetaOffer {
  id?: string;
  title: string;
  description: string;
  discountLabel: string;
  expiresAt?: string;
  reason?: string;
  childId?: string;
  childName?: string;
}

interface Props {
  offer: MetaOffer;
  onPress?: () => void;
}

export default function ParentMetaOfferCard({ offer, onPress }: Props) {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Navigate to billing
      router.push('/billing');
    }
  };

  // Calculate time remaining
  let timeRemaining = '';
  if (offer.expiresAt) {
    try {
      const expiresDate = parseISO(offer.expiresAt);
      const hoursLeft = differenceInHours(expiresDate, new Date());
      
      if (hoursLeft > 24) {
        const daysLeft = Math.floor(hoursLeft / 24);
        timeRemaining = `${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дні' : 'днів'}`;
      } else if (hoursLeft > 0) {
        timeRemaining = `${hoursLeft} ${hoursLeft === 1 ? 'година' : hoursLeft < 5 ? 'години' : 'годин'}`;
      } else {
        timeRemaining = 'Скоро закінчується';
      }
    } catch (e) {
      // Ignore date parse errors
    }
  }

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      {/* Gradient-like background effect */}
      <View style={styles.bgPattern} />
      
      {/* Header with icon */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="gift" size={24} color="#FFFFFF" />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>{offer.title}</Text>
          {offer.childName && (
            <Text style={styles.childName}>для {offer.childName}</Text>
          )}
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description}>{offer.description}</Text>

      {/* Discount Badge */}
      <View style={styles.discountRow}>
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>{offer.discountLabel}</Text>
        </View>
        
        {timeRemaining && (
          <View style={styles.timerBadge}>
            <Ionicons name="time-outline" size={14} color="#F59E0B" />
            <Text style={styles.timerText}>Діє ще {timeRemaining}</Text>
          </View>
        )}
      </View>

      {/* Reason (why user got this offer) */}
      {offer.reason && (
        <Text style={styles.reason}>
          <Ionicons name="information-circle-outline" size={12} color="#9CA3AF" /> {offer.reason}
        </Text>
      )}

      {/* CTA */}
      <View style={styles.ctaRow}>
        <Text style={styles.ctaText}>Скористатися пропозицією</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F0F10',
    borderRadius: 20,
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  bgPattern: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(227, 6, 19, 0.15)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#E30613',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 24,
  },
  childName: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  description: {
    fontSize: 14,
    color: '#D1D5DB',
    lineHeight: 20,
    marginBottom: 14,
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  discountBadge: {
    backgroundColor: '#E30613',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  discountText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  reason: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 14,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
