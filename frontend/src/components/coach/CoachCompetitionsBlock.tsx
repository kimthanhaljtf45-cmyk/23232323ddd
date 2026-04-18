import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface CoachCompetitionsBlockProps {
  onParticipantPress?: (participantId: string, childId: string) => void;
}

export default function CoachCompetitionsBlock({ onParticipantPress }: CoachCompetitionsBlockProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['coach-today-competitions'],
    queryFn: () => api.getCoachTodayCompetitions(),
  });

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="trophy" size={22} color="#F59E0B" />
          <Text style={styles.title}>Змагання сьогодні</Text>
        </View>
        <ActivityIndicator size="small" color="#E30613" style={{ marginVertical: 16 }} />
      </View>
    );
  }

  if (error || !data) {
    return null;
  }

  const { participants, summary } = data;

  if (participants.length === 0) {
    return null; // Don't show if no competitions today
  }

  const getMedalIcon = (medal: string | null) => {
    if (!medal) return null;
    switch (medal) {
      case 'GOLD': return '🥇';
      case 'SILVER': return '🥈';
      case 'BRONZE': return '🥉';
      default: return '🏅';
    }
  };

  const getStatusBadge = (status: string, paid: boolean) => {
    if (status === 'REJECTED') {
      return { text: 'Відхилено', bg: '#FEE2E2', color: '#DC2626' };
    }
    if (status === 'PENDING') {
      return { text: 'Очікує', bg: '#FEF3C7', color: '#D97706' };
    }
    if (!paid) {
      return { text: 'Не оплачено', bg: '#FEE2E2', color: '#DC2626' };
    }
    return { text: 'Готово', bg: '#DCFCE7', color: '#16A34A' };
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={22} color="#F59E0B" />
          <Text style={styles.title}>Змагання сьогодні</Text>
        </View>
        <View style={styles.summaryBadge}>
          <Text style={styles.summaryText}>{summary.total}</Text>
        </View>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.confirmed}</Text>
          <Text style={styles.statLabel}>Підтв.</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{summary.pending}</Text>
          <Text style={styles.statLabel}>Очікує</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, summary.unpaid > 0 && styles.statWarning]}>
            {summary.unpaid}
          </Text>
          <Text style={styles.statLabel}>Не опл.</Text>
        </View>
      </View>

      {/* Participants List */}
      <View style={styles.participantsList}>
        {participants.map((item, index) => {
          const badge = getStatusBadge(item.status, item.paid);
          
          return (
            <TouchableOpacity
              key={item.participantId}
              style={[
                styles.participantCard,
                index === participants.length - 1 && { marginBottom: 0 },
              ]}
              onPress={() => onParticipantPress?.(item.participantId, item.childId)}
              activeOpacity={0.7}
            >
              <View style={styles.participantMain}>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>{item.childName}</Text>
                  <View style={styles.participantMeta}>
                    <Text style={styles.participantBelt}>
                      {item.childBelt} пояс
                    </Text>
                    {item.category && (
                      <Text style={styles.participantCategory}>
                        • {item.category}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={styles.participantStatus}>
                  {item.result ? (
                    <View style={styles.medalBadge}>
                      <Text style={styles.medalIcon}>
                        {getMedalIcon(item.result.medal)}
                      </Text>
                      <Text style={styles.medalPlace}>{item.result.place}</Text>
                    </View>
                  ) : (
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusText, { color: badge.color }]}>
                        {badge.text}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Competition name */}
              <Text style={styles.competitionName} numberOfLines={1}>
                {item.competitionTitle}
              </Text>

              {/* Warnings */}
              {!item.paid && item.hasFee && item.status !== 'REJECTED' && (
                <View style={styles.warningRow}>
                  <Ionicons name="warning" size={14} color="#DC2626" />
                  <Text style={styles.warningText}>
                    Не оплачено: {item.feeAmount} грн
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  summaryBadge: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  summaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F0F10',
  },
  statWarning: {
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
  },
  participantsList: {
    gap: 8,
  },
  participantCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  participantMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F0F10',
  },
  participantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  participantBelt: {
    fontSize: 12,
    color: '#6B7280',
  },
  participantCategory: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  participantStatus: {},
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  medalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  medalIcon: {
    fontSize: 14,
  },
  medalPlace: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  competitionName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    gap: 4,
  },
  warningText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
});
