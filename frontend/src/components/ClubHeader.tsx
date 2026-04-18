import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useClub } from '../contexts/ClubContext';

type Props = {
  showSelector?: boolean;
  compact?: boolean;
};

export const ClubHeader: React.FC<Props> = ({ showSelector = false, compact = false }) => {
  const { activeClub, clubs, setActiveClub } = useClub();

  if (!activeClub) return null;

  const planColor = activeClub.plan === 'ENTERPRISE' ? '#B45309' : activeClub.plan === 'PRO' ? '#7C3AED' : '#6B7280';

  if (compact) {
    return (
      <View style={s.compactContainer}>
        <View style={[s.compactLogo, { backgroundColor: activeClub.primaryColor || '#DC2626' }]}>
          <Text style={s.compactLogoText}>{activeClub.name?.charAt(0)}</Text>
        </View>
        <View style={s.compactInfo}>
          <Text style={s.compactName} numberOfLines={1}>{activeClub.name}</Text>
          <View style={[s.planBadge, { backgroundColor: planColor + '20' }]}>
            <Text style={[s.planText, { color: planColor }]}>{activeClub.plan}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={[s.logoBox, { backgroundColor: activeClub.primaryColor || '#DC2626' }]}>
        <Text style={s.logoText}>{activeClub.name?.charAt(0)}</Text>
      </View>
      <View style={s.info}>
        <Text style={s.clubName}>{activeClub.name}</Text>
        <Text style={s.clubMeta}>
          {activeClub.city ? `${activeClub.city} • ` : ''}
          {activeClub.coachCount || 0} тренерів • {activeClub.studentCount || 0} учнів
        </Text>
      </View>
      <View style={[s.planBadge, { backgroundColor: planColor + '20' }]}>
        <Text style={[s.planText, { color: planColor }]}>{activeClub.plan}</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#0F0F10', gap: 12 },
  logoBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  info: { flex: 1 },
  clubName: { fontSize: 17, fontWeight: '700', color: '#fff' },
  clubMeta: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  planBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  planText: { fontSize: 11, fontWeight: '700' },
  compactContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compactLogo: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  compactLogoText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  compactInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  compactName: { fontSize: 14, fontWeight: '600', color: '#111', maxWidth: 120 },
});
