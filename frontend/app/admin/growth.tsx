import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';

interface OfferVariant {
  _id: string;
  name: string;
  segment: string;
  discountPercent: number;
  title?: string;
  views: number;
  conversions: number;
  conversionRate: string;
  isActive: boolean;
  priority: number;
}

export default function GrowthAnalyticsScreen() {
  const [offers, setOffers] = useState<OfferVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const loadData = useCallback(async () => {
    try {
      const [offersData, metaStats] = await Promise.all([
        api.get('/growth/offers').catch(() => []),
        api.get('/meta/admin').catch(() => null),
      ]);
      
      setOffers(offersData || []);
      setStats(metaStats);
    } catch (error) {
      console.log('Error loading growth data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleOptimize = async () => {
    Alert.alert(
      'Авто-оптимізація',
      'Вимкнути офери з конверсією < 5% (мін. 50 переглядів)?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Запустити',
          onPress: async () => {
            try {
              const result = await api.post('/growth/optimize');
              Alert.alert('Готово', `Вимкнено оферів: ${result.disabledCount}`);
              loadData();
            } catch (error) {
              Alert.alert('Помилка', 'Не вдалося запустити оптимізацію');
            }
          },
        },
      ]
    );
  };

  const handleSeed = async () => {
    try {
      await api.post('/growth/seed');
      Alert.alert('Готово', 'Офери створено');
      loadData();
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося створити офери');
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'CHURN_RISK': return '#EF4444';
      case 'WARNING': return '#F59E0B';
      case 'VIP': return '#22C55E';
      case 'ACTIVE': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  const getSegmentLabel = (segment: string) => {
    switch (segment) {
      case 'CHURN_RISK': return 'Ризик';
      case 'WARNING': return 'Увага';
      case 'VIP': return 'VIP';
      case 'ACTIVE': return 'Активні';
      case 'NEW': return 'Нові';
      default: return segment;
    }
  };

  // Group offers by segment
  const groupedOffers = offers.reduce((acc, offer) => {
    if (!acc[offer.segment]) acc[offer.segment] = [];
    acc[offer.segment].push(offer);
    return acc;
  }, {} as Record<string, OfferVariant[]>);

  // Calculate total stats
  const totalViews = offers.reduce((sum, o) => sum + o.views, 0);
  const totalConversions = offers.reduce((sum, o) => sum + o.conversions, 0);
  const avgCR = totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(1) : '0.0';

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Growth Analytics</Text>
        <TouchableOpacity onPress={handleOptimize} style={styles.optimizeBtn}>
          <Ionicons name="flash" size={20} color="#E30613" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
      >
        {/* Overview Stats */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Огляд A/B тестування</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{offers.length}</Text>
              <Text style={styles.statLabel}>Оферів</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalViews}</Text>
              <Text style={styles.statLabel}>Переглядів</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{totalConversions}</Text>
              <Text style={styles.statLabel}>Конверсій</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: '#22C55E' }]}>{avgCR}%</Text>
              <Text style={styles.statLabel}>CR</Text>
            </View>
          </View>
        </View>

        {/* MetaBrain Stats */}
        {stats && (
          <View style={styles.metaCard}>
            <Text style={styles.sectionTitle}>MetaBrain Impact</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="people" size={24} color="#3B82F6" />
                <Text style={styles.metaValue}>{stats.summary?.totalStudents || 0}</Text>
                <Text style={styles.metaLabel}>Учнів</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="warning" size={24} color="#EF4444" />
                <Text style={styles.metaValue}>{stats.summary?.criticalRisks || 0}</Text>
                <Text style={styles.metaLabel}>Критичних</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="cash" size={24} color="#22C55E" />
                <Text style={styles.metaValue}>{stats.revenue?.savedByDiscounts || 0}</Text>
                <Text style={styles.metaLabel}>Врятовано</Text>
              </View>
            </View>
          </View>
        )}

        {/* Offers by Segment */}
        {Object.keys(groupedOffers).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Немає оферів</Text>
            <Text style={styles.emptyDesc}>Створіть тестові офери для A/B тестування</Text>
            <TouchableOpacity style={styles.seedBtn} onPress={handleSeed}>
              <Text style={styles.seedBtnText}>Створити офери</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(groupedOffers).map(([segment, segmentOffers]) => (
            <View key={segment} style={styles.segmentSection}>
              <View style={styles.segmentHeader}>
                <View style={[styles.segmentDot, { backgroundColor: getSegmentColor(segment) }]} />
                <Text style={styles.segmentTitle}>{getSegmentLabel(segment)}</Text>
                <Text style={styles.segmentCount}>{segmentOffers.length} оферів</Text>
              </View>

              {segmentOffers
                .sort((a, b) => parseFloat(b.conversionRate) - parseFloat(a.conversionRate))
                .map((offer, index) => (
                  <View 
                    key={offer._id} 
                    style={[
                      styles.offerCard,
                      !offer.isActive && styles.offerCardInactive,
                      index === 0 && styles.offerCardBest,
                    ]}
                  >
                    <View style={styles.offerHeader}>
                      <View style={styles.offerNameRow}>
                        <Text style={styles.offerName}>{offer.name}</Text>
                        {index === 0 && offer.views >= 10 && (
                          <View style={styles.bestBadge}>
                            <Text style={styles.bestBadgeText}>Лідер</Text>
                          </View>
                        )}
                        {!offer.isActive && (
                          <View style={styles.inactiveBadge}>
                            <Text style={styles.inactiveBadgeText}>Вимкнено</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.offerDiscount}>-{offer.discountPercent}%</Text>
                    </View>

                    <View style={styles.offerStats}>
                      <View style={styles.offerStat}>
                        <Ionicons name="eye-outline" size={14} color="#6B7280" />
                        <Text style={styles.offerStatValue}>{offer.views}</Text>
                      </View>
                      <View style={styles.offerStat}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#22C55E" />
                        <Text style={styles.offerStatValue}>{offer.conversions}</Text>
                      </View>
                      <View style={styles.offerStat}>
                        <Ionicons name="trending-up-outline" size={14} color="#3B82F6" />
                        <Text style={[styles.offerStatValue, { color: '#3B82F6' }]}>
                          {offer.conversionRate}%
                        </Text>
                      </View>
                    </View>

                    {/* Progress bar showing relative CR */}
                    <View style={styles.progressBar}>
                      <View 
                        style={[
                          styles.progressFill, 
                          { 
                            width: `${Math.min(parseFloat(offer.conversionRate) * 3, 100)}%`,
                            backgroundColor: parseFloat(offer.conversionRate) >= 10 ? '#22C55E' : 
                                           parseFloat(offer.conversionRate) >= 5 ? '#F59E0B' : '#EF4444'
                          }
                        ]} 
                      />
                    </View>
                  </View>
                ))}
            </View>
          ))
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionCard} onPress={handleSeed}>
            <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
            <Text style={styles.actionText}>Додати офери</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCard} onPress={handleOptimize}>
            <Ionicons name="flash-outline" size={24} color="#F59E0B" />
            <Text style={styles.actionText}>Авто-оптимізація</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    textAlign: 'center',
  },
  optimizeBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F0F10',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  metaCard: {
    backgroundColor: '#0F0F10',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    marginTop: 16,
  },
  emptyDesc: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  seedBtn: {
    backgroundColor: '#E30613',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  seedBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  segmentSection: {
    marginBottom: 20,
  },
  segmentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  segmentDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    flex: 1,
  },
  segmentCount: {
    fontSize: 13,
    color: '#6B7280',
  },
  offerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  offerCardInactive: {
    opacity: 0.6,
  },
  offerCardBest: {
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  offerNameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  offerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F10',
  },
  bestBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#22C55E',
  },
  inactiveBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  offerDiscount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#E30613',
  },
  offerStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  offerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  offerStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
});
