import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

interface Competition {
  _id: string;
  title: string;
  date: string;
  location: string;
  status: string;
  hasFee: boolean;
  feeAmount?: number;
}

interface Props {
  competitions: Competition[];
}

export function UpcomingCompetitionsBlock({ competitions }: Props) {
  const router = useRouter();

  if (!competitions || competitions.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="trophy" size={20} color="#F59E0B" />
          <Text style={styles.title}>Змагання</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.push('/competitions')}
          style={styles.viewAllButton}
        >
          <Text style={styles.viewAllText}>Всі</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {competitions.slice(0, 2).map((comp) => (
        <TouchableOpacity
          key={comp._id}
          style={styles.competitionCard}
          onPress={() => router.push(`/competitions/${comp._id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.dateBox}>
            <Text style={styles.dateText}>{formatDate(comp.date)}</Text>
          </View>
          
          <View style={styles.infoContainer}>
            <Text style={styles.competitionTitle} numberOfLines={1}>
              {comp.title}
            </Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {comp.location}
              </Text>
            </View>
          </View>

          {comp.hasFee && comp.feeAmount && (
            <View style={styles.feeBadge}>
              <Text style={styles.feeText}>{comp.feeAmount} ₴</Text>
            </View>
          )}

          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      ))}

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/competitions/my')}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Мої участі</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.actionButtonHighlight]}
          onPress={() => router.push('/competitions/champions')}
        >
          <Ionicons name="medal-outline" size={16} color="#F59E0B" />
          <Text style={[styles.actionText, { color: '#F59E0B' }]}>Чемпіони</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  competitionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    gap: 12,
  },
  dateBox: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  infoContainer: {
    flex: 1,
  },
  competitionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  feeBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    gap: 6,
  },
  actionButtonHighlight: {
    backgroundColor: '#FFFBEB',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
