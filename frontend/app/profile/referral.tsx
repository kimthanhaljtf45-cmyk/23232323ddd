import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Share, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { colors, spacing, fontSizes, borderRadius } from '@/theme';

interface ReferralData {
  myCode: string;
  invitedCount: number;
  confirmedCount: number;
  rewardsEarned: string[];
  referrals: Array<{
    _id: string;
    status: string;
    invitedUserId?: string;
    createdAt: string;
  }>;
}

export default function ReferralScreen() {
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      setLoading(true);
      const result = await api.get('/referrals/my');
      setData(result);
    } catch (error) {
      console.error('Failed to load referral data:', error);
    } finally {
      setLoading(false);
    }
  };

  const shareCode = async () => {
    if (!data?.myCode) return;
    
    try {
      await Share.share({
        message: `Приєднуйся до ATAKA! Використай мій реферальний код: ${data.myCode} і отримай знижку 10% на перший місяць!`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Очікує';
      case 'REGISTERED':
        return 'Зареєстрований';
      case 'CONFIRMED':
        return 'Підтверджений';
      case 'REWARDED':
        return 'Нагороджено';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return colors.warning;
      case 'REGISTERED':
        return colors.info;
      case 'CONFIRMED':
      case 'REWARDED':
        return colors.success;
      default:
        return colors.textSecondary;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Запроси друга</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Твій реферальний код</Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeText}>{data?.myCode || '...'}</Text>
          </View>
          <TouchableOpacity style={styles.shareButton} onPress={shareCode}>
            <Ionicons name="share-outline" size={20} color="#FFF" />
            <Text style={styles.shareButtonText}>Поділитися</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{data?.invitedCount || 0}</Text>
            <Text style={styles.statLabel}>Запрошено</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{data?.confirmedCount || 0}</Text>
            <Text style={styles.statLabel}>Підтверджено</Text>
          </View>
        </View>

        {/* Rewards Info */}
        <View style={styles.infoCard}>
          <View style={styles.infoTitleRow}>
            <Ionicons name="gift" size={22} color={colors.primary} />
            <Text style={styles.infoTitle}>Нагороди</Text>
          </View>
          <View style={styles.rewardRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.rewardText}>1 друг = знижка 50%</Text>
          </View>
          <View style={styles.rewardRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.rewardText}>2+ друзів = безкоштовний місяць</Text>
          </View>
          <View style={styles.rewardRow}>
            <Ionicons name="gift-outline" size={20} color={colors.primary} />
            <Text style={styles.rewardText}>Твій друг отримає -10%</Text>
          </View>
        </View>

        {/* Earned Rewards */}
        {data?.rewardsEarned && data.rewardsEarned.length > 0 && (
          <View style={styles.earnedCard}>
            <View style={styles.infoTitleRow}>
              <Ionicons name="trophy" size={22} color={colors.warning} />
              <Text style={styles.infoTitle}>Отримані нагороди</Text>
            </View>
            {data.rewardsEarned.map((reward, index) => (
              <View key={index} style={styles.earnedRow}>
                <Ionicons name="star" size={18} color={colors.warning} />
                <Text style={styles.earnedText}>{reward}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Referral History */}
        {data?.referrals && data.referrals.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Історія запрошень</Text>
            {data.referrals.map((ref) => (
              <View key={ref._id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.historyText}>Запрошений друг</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ref.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(ref.status) }]}>
                    {getStatusLabel(ref.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  codeCard: {
    backgroundColor: colors.text,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  codeLabel: {
    fontSize: fontSizes.sm,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.base,
  },
  codeText: {
    fontSize: fontSizes['2xl'],
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  shareButtonText: {
    fontSize: fontSizes.base,
    fontWeight: '600',
    color: '#FFF',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.base,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: fontSizes['2xl'],
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  infoCard: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rewardText: {
    fontSize: fontSizes.base,
    color: colors.text,
  },
  earnedCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    marginBottom: spacing.base,
  },
  earnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  earnedText: {
    fontSize: fontSizes.base,
    fontWeight: '600',
    color: colors.text,
  },
  historySection: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyText: {
    fontSize: fontSizes.base,
    color: colors.text,
  },
  statusBadge: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statusText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
});
