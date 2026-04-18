import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * COACH GROUPS - УПРАВЛІННЯ ЮНІТАМИ
 * 
 * Кожна група = бізнес-юніт.
 * Тренер мусить мислити групами як живими одиницями.
 * 
 * Дані завантажуються з API.
 */

interface Group {
  id: string;
  name: string;
  ageRange?: string;
  studentsCount: number;
  maxStudents: number;
  attendance: number;
  retention: number;
  churn: number;
  trainingsPerWeek: number;
  status: 'good' | 'warning' | 'risk';
  revenue: number;
  healthScore?: number;
}

export default function CoachGroupsScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await api.get('/coach/groups');
      const data = response?.data || response || [];
      
      // Transform API data to expected format
      const transformed = (Array.isArray(data) ? data : []).map((g: any) => ({
        id: g.id || g._id,
        name: g.name,
        ageRange: g.ageRange,
        studentsCount: g.studentsCount || 0,
        maxStudents: g.maxStudents || g.capacity || 15,
        attendance: g.attendance || g.healthScore || 80,
        retention: g.retention || 85,
        churn: g.churn || 10,
        trainingsPerWeek: g.trainingsPerWeek || 3,
        status: g.status || (g.healthScore >= 70 ? 'good' : g.healthScore >= 40 ? 'warning' : 'risk'),
        revenue: g.revenue || (g.studentsCount || 0) * 2000,
        healthScore: g.healthScore,
      }));
      
      setGroups(transformed);
    } catch (error) {
      console.log('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchGroups();
    setRefreshing(false);
  }, [fetchGroups]);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good': return '#22C55E';
      case 'warning': return '#F59E0B';
      case 'risk': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusText = (status: string): string => {
    switch (status) {
      case 'good': return 'Добре';
      case 'warning': return 'Увага';
      case 'risk': return 'Ризик';
      default: return '';
    }
  };

  const totalStudents = groups.reduce((sum, g) => sum + g.studentsCount, 0);
  const avgAttendance = Math.round(
    groups.reduce((sum, g) => sum + g.attendance, 0) / groups.length
  );
  const totalRevenue = groups.reduce((sum, g) => sum + g.revenue, 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
          <Text style={styles.loadingText}>Завантаження груп...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{groups.length}</Text>
            <Text style={styles.summaryLabel}>Групи</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalStudents}</Text>
            <Text style={styles.summaryLabel}>Учнів</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{avgAttendance}%</Text>
            <Text style={styles.summaryLabel}>Attendance</Text>
          </View>
        </View>

        {/* Total Revenue */}
        <View style={styles.revenueCard}>
          <View style={styles.revenueHeader}>
            <Ionicons name="wallet" size={20} color="#fff" />
            <Text style={styles.revenueLabel}>Загальний revenue</Text>
          </View>
          <Text style={styles.revenueValue}>{totalRevenue.toLocaleString()} грн</Text>
        </View>

        {/* Groups List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Мої групи</Text>
          
          {groups.map((group) => (
            <Pressable
              key={group.id}
              style={styles.groupCard}
              onPress={() => router.push(`/coach/group/${group.id}`)}
            >
              {/* Header */}
              <View style={styles.groupHeader}>
                <View>
                  <Text style={styles.groupName}>{group.name}</Text>
                  {group.ageRange && (
                    <Text style={styles.groupAge}>{group.ageRange}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(group.status) + '20' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(group.status) },
                    ]}
                  />
                  <Text
                    style={[styles.statusText, { color: getStatusColor(group.status) }]}
                  >
                    {getStatusText(group.status)}
                  </Text>
                </View>
              </View>

              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Ionicons name="people" size={18} color="#6B7280" />
                  <Text style={styles.statValue}>
                    {group.studentsCount}/{group.maxStudents}
                  </Text>
                  <Text style={styles.statLabel}>учнів</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="calendar" size={18} color="#6B7280" />
                  <Text style={styles.statValue}>{group.trainingsPerWeek}x</Text>
                  <Text style={styles.statLabel}>тиждень</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={group.attendance >= 80 ? '#22C55E' : '#F59E0B'}
                  />
                  <Text style={styles.statValue}>{group.attendance}%</Text>
                  <Text style={styles.statLabel}>attendance</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons
                    name="trending-down"
                    size={18}
                    color={group.churn > 20 ? '#EF4444' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.statValue,
                      group.churn > 20 && { color: '#EF4444' },
                    ]}
                  >
                    {group.churn}%
                  </Text>
                  <Text style={styles.statLabel}>churn</Text>
                </View>
              </View>

              {/* Footer */}
              <View style={styles.groupFooter}>
                <View style={styles.groupFooterLeft}>
                  <Text style={styles.retentionText}>
                    Retention: <Text style={styles.retentionValue}>{group.retention}%</Text>
                  </Text>
                  <Text style={styles.revenueText}>
                    {group.revenue.toLocaleString()} грн/міс
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  // Summary
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#0F0F10',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  // Revenue
  revenueCard: {
    backgroundColor: '#22C55E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  revenueValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  // Section
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 14,
  },
  // Group Card
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F0F10',
  },
  groupAge: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginTop: 6,
  },
  statLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  // Footer
  groupFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
  },
  groupFooterLeft: {
    flex: 1,
  },
  retentionText: {
    fontSize: 14,
    color: '#6B7280',
  },
  retentionValue: {
    fontWeight: '700',
    color: '#0F0F10',
  },
  revenueText: {
    fontSize: 13,
    color: '#22C55E',
    fontWeight: '600',
    marginTop: 4,
  },
});
