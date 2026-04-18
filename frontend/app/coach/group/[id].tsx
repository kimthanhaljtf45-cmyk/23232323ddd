import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/lib/api';

/**
 * GROUP DETAIL - БІЗНЕС-ЦЕНТР ГРУПИ (ENHANCED)
 * 
 * Тепер це повноцінна панель управління з:
 * - Group Health Score
 * - Money Block (фінанси)
 * - Capacity Block
 * - Churn Alert
 * - Enhanced Action Block
 * - Student Badges
 */

interface Student {
  id: string;
  name: string;
  attendanceRate: number;
  belt?: string;
  riskLevel: 'low' | 'warning' | 'critical';
  riskScore: number;
  debt: number;
  lastVisitDays: number;
  badges: Array<{ type: string; label: string; color: string }>;
  parentPhone?: string;
}

interface GroupHealth {
  score: number;
  status: 'good' | 'warning' | 'critical';
  attendance: number;
  retention: number;
  churn: number;
  revenue: {
    expected: number;
    received: number;
    debt: number;
    debtorsCount: number;
  };
  capacity: {
    current: number;
    max: number;
    fillRate: number;
    freeSlots: number;
  };
  atRisk: Array<{
    studentId: string;
    studentName: string;
    reason: string;
    daysInactive: number;
    hasDebt: boolean;
  }>;
  dynamics: {
    attendanceTrend: number[];
    churnTrend: number[];
    revenueTrend: number[];
    trendReason?: string;
  };
  coachScoreImpact: number;
}

type FilterType = 'all' | 'risk' | 'debt' | 'new' | 'top';

export default function GroupDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const [group, setGroup] = useState<any>(null);
  const [health, setHealth] = useState<GroupHealth | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get(`/coach/groups/${id}`);
      const d = response?.data || response;
      setGroup(d?.group);
      setHealth(d?.health);
      setStudents(d?.students || []);
      setSchedule(d?.schedule || []);
      setTrainingHistory(d?.trainingHistory || []);
    } catch (error) {
      console.log('Error fetching group:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // Filter students
  const filteredStudents = students.filter(s => {
    switch (activeFilter) {
      case 'risk': return s.riskLevel === 'critical' || s.riskLevel === 'warning';
      case 'debt': return s.debt > 0;
      case 'top': return s.badges.some(b => b.type === 'top');
      case 'new': return s.lastVisitDays <= 7 && s.attendanceRate < 50;
      default: return true;
    }
  });

  // Counts
  const riskCount = students.filter(s => s.riskLevel === 'critical').length;
  const warningCount = students.filter(s => s.riskLevel === 'warning').length;
  const debtCount = students.filter(s => s.debt > 0).length;
  const topCount = students.filter(s => s.badges.some(b => b.type === 'top')).length;

  const getHealthColor = (score: number) => {
    if (score >= 70) return '#22C55E';
    if (score >= 40) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'good': return 'Стабільна';
      case 'warning': return 'Увага';
      case 'critical': return 'Ризик';
      default: return '';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return '#22C55E';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  // === QUICK ACTIONS HANDLERS ===
  
  const handleContactRiskStudents = () => {
    const riskStudents = students.filter(s => s.riskLevel === 'critical' || s.riskLevel === 'warning');
    if (riskStudents.length === 0) {
      return; // No risk students
    }
    // Navigate to messages with context
    router.push({
      pathname: '/coach/messages',
      params: { action: 'risk', groupId: id, studentIds: riskStudents.map(s => s.id).join(',') }
    });
  };

  const handleCallDebtors = async () => {
    const debtors = students.filter(s => s.debt > 0);
    if (debtors.length > 0 && debtors[0].parentPhone) {
      try {
        await Linking.openURL(`tel:${debtors[0].parentPhone}`);
      } catch (error) {
        console.log('Error opening phone:', error);
      }
    }
  };
  
  const handleInviteAbsent = () => {
    // Get students who were absent recently
    const absentStudents = students.filter(s => s.lastVisitDays > 5);
    if (absentStudents.length === 0) {
      return;
    }
    // Navigate to messages with invite context
    router.push({
      pathname: '/coach/messages',
      params: { action: 'invite', groupId: id, studentIds: absentStudents.map(s => s.id).join(',') }
    });
  };
  
  const handleLaunchPromotion = () => {
    // Navigate to promotions screen
    router.push({
      pathname: '/coach/promotions',
      params: { groupId: id }
    });
  };

  const renderTrendBar = (values: number[], maxValue: number, color: string, isIncreasing?: boolean) => {
    const max = Math.max(...values, maxValue);
    return (
      <View style={styles.trendBars}>
        {values.map((val, i) => (
          <View
            key={i}
            style={[
              styles.trendBar,
              {
                height: Math.max(4, (val / max) * 40),
                backgroundColor: isIncreasing 
                  ? (i === values.length - 1 ? '#EF4444' : color)
                  : (i === values.length - 1 ? '#22C55E' : color),
                opacity: 0.5 + (i * 0.15),
              },
            ]}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      </SafeAreaView>
    );
  }

  const dayNames: Record<number, string> = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Нд' };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: group?.name || 'Група',
          headerShown: true,
          headerStyle: { backgroundColor: '#fff' },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={28} color="#111" />
            </Pressable>
          ),
        }}
      />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#E30613" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* GROUP HEALTH SCORE */}
        {health && (
          <View style={[styles.healthCard, { borderColor: getHealthColor(health.score) }]}>
            <View style={styles.healthHeader}>
              <View>
                <Text style={styles.healthLabel}>Group Health Score</Text>
                <View style={styles.healthScoreRow}>
                  <Text style={[styles.healthScore, { color: getHealthColor(health.score) }]}>
                    {health.score}
                  </Text>
                  <View style={[styles.healthBadge, { backgroundColor: getHealthColor(health.score) + '20' }]}>
                    <Text style={[styles.healthBadgeText, { color: getHealthColor(health.score) }]}>
                      {getStatusText(health.status)}
                    </Text>
                  </View>
                </View>
              </View>
              {health.coachScoreImpact !== 0 && (
                <View style={[
                  styles.impactBadge,
                  { backgroundColor: health.coachScoreImpact < 0 ? '#FEE2E2' : '#D1FAE5' }
                ]}>
                  <Ionicons 
                    name={health.coachScoreImpact < 0 ? 'trending-down' : 'trending-up'} 
                    size={16} 
                    color={health.coachScoreImpact < 0 ? '#EF4444' : '#22C55E'} 
                  />
                  <Text style={[
                    styles.impactText,
                    { color: health.coachScoreImpact < 0 ? '#EF4444' : '#065F46' }
                  ]}>
                    {health.coachScoreImpact > 0 ? '+' : ''}{health.coachScoreImpact}
                  </Text>
                  <Text style={[
                    styles.impactSubtext,
                    { color: health.coachScoreImpact < 0 ? '#EF4444' : '#065F46' }
                  ]}>
                    Coach Score
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* HEADER INFO - Group Overview Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerCardTop}>
            <View style={styles.headerCardLeft}>
              <Text style={styles.groupName}>{group?.name}</Text>
              <Text style={styles.ageRange}>{group?.ageRange}</Text>
            </View>
            {health && (
              <View style={[styles.headerScoreBadge, { backgroundColor: getHealthColor(health.score) + '20' }]}>
                <Text style={[styles.headerScoreValue, { color: getHealthColor(health.score) }]}>{health.score}</Text>
              </View>
            )}
          </View>
          {/* Quick stats row */}
          <View style={styles.headerStatsRow}>
            <View style={styles.headerStat}>
              <Ionicons name="people" size={16} color="#6B7280" />
              <Text style={styles.headerStatValue}>{students.length}</Text>
              <Text style={styles.headerStatLabel}>учнів</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Ionicons name="checkmark-circle" size={16} color={health?.attendance >= 80 ? '#22C55E' : '#F59E0B'} />
              <Text style={styles.headerStatValue}>{health?.attendance || 0}%</Text>
              <Text style={styles.headerStatLabel}>attendance</Text>
            </View>
            <View style={styles.headerStatDivider} />
            <View style={styles.headerStat}>
              <Ionicons name="repeat" size={16} color="#3B82F6" />
              <Text style={styles.headerStatValue}>{health?.retention || 0}%</Text>
              <Text style={styles.headerStatLabel}>retention</Text>
            </View>
          </View>
          {/* Schedule hint */}
          {schedule.length > 0 && (
            <View style={styles.headerScheduleRow}>
              <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
              <Text style={styles.headerScheduleText}>
                {schedule.map(s => dayNames[s.dayOfWeek]).join(', ')} о {schedule[0]?.startTime}
              </Text>
            </View>
          )}
        </View>

        {/* MONEY BLOCK */}
        {health && (
          <View style={styles.moneyCard}>
            <View style={styles.moneyHeader}>
              <Ionicons name="wallet" size={20} color="#22C55E" />
              <Text style={styles.moneyTitle}>Фінанси групи</Text>
            </View>
            <View style={styles.moneyGrid}>
              <View style={styles.moneyItem}>
                <Text style={styles.moneyLabel}>Очікується</Text>
                <Text style={styles.moneyValue}>{health.revenue.expected.toLocaleString()} ₴</Text>
              </View>
              <View style={styles.moneyItem}>
                <Text style={styles.moneyLabel}>Отримано</Text>
                <Text style={[styles.moneyValue, { color: '#22C55E' }]}>
                  {health.revenue.received.toLocaleString()} ₴
                </Text>
              </View>
              <View style={styles.moneyItem}>
                <Text style={styles.moneyLabel}>Борг</Text>
                <Text style={[styles.moneyValue, { color: health.revenue.debt > 0 ? '#EF4444' : '#6B7280' }]}>
                  {health.revenue.debt.toLocaleString()} ₴
                </Text>
              </View>
            </View>
            {health.revenue.debtorsCount > 0 && (
              <Pressable style={styles.debtorsBtn} onPress={handleCallDebtors}>
                <Ionicons name="cash-outline" size={16} color="#E30613" />
                <Text style={styles.debtorsBtnText}>
                  Подивитись боржників ({health.revenue.debtorsCount})
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* CAPACITY BLOCK */}
        {health && (
          <View style={styles.capacityCard}>
            <View style={styles.capacityHeader}>
              <Ionicons name="people" size={20} color="#3B82F6" />
              <Text style={styles.capacityTitle}>Заповненість</Text>
            </View>
            <View style={styles.capacityContent}>
              <View style={styles.capacityMain}>
                <Text style={styles.capacityNumbers}>
                  {health.capacity.current} / {health.capacity.max} місць
                </Text>
                <Text style={styles.capacityPercent}>{health.capacity.fillRate}%</Text>
              </View>
              <View style={styles.capacityBar}>
                <View 
                  style={[
                    styles.capacityBarFill, 
                    { width: `${health.capacity.fillRate}%` }
                  ]} 
                />
              </View>
              {health.capacity.freeSlots > 0 && (
                <View style={styles.freeSlotsRow}>
                  <Text style={styles.freeSlotsText}>
                    {health.capacity.freeSlots} місць вільні
                  </Text>
                  <Pressable style={styles.inviteBtn}>
                    <Ionicons name="add" size={16} color="#fff" />
                    <Text style={styles.inviteBtnText}>Запросити нових</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {/* CHURN ALERT */}
        {health && health.atRisk.length > 0 && (
          <View style={styles.churnCard}>
            <View style={styles.churnHeader}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.churnTitle}>Група в ризику</Text>
            </View>
            {health.atRisk.slice(0, 3).map((student, i) => (
              <Pressable 
                key={i} 
                style={styles.churnItem}
                onPress={() => router.push(`/coach/student/${student.studentId}`)}
              >
                <View style={styles.churnItemLeft}>
                  <Text style={styles.churnName}>{student.studentName}</Text>
                  <Text style={styles.churnReason}>{student.reason}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </Pressable>
            ))}
            <Pressable style={styles.resolveBtn} onPress={handleContactRiskStudents}>
              <Text style={styles.resolveBtnText}>Вирішити</Text>
            </Pressable>
          </View>
        )}

        {/* ENHANCED ACTION BLOCK */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Швидкі дії</Text>
          <View style={styles.actionGrid}>
            <Pressable 
              style={[styles.actionCard, students.filter(s => s.riskLevel !== 'low').length === 0 && styles.actionCardDisabled]} 
              onPress={handleContactRiskStudents}
            >
              <Ionicons name="chatbubble" size={24} color={students.filter(s => s.riskLevel !== 'low').length > 0 ? "#E30613" : "#9CA3AF"} />
              <Text style={[styles.actionCardText, students.filter(s => s.riskLevel !== 'low').length === 0 && styles.actionCardTextDisabled]}>
                Написати ризиковим
              </Text>
              {students.filter(s => s.riskLevel !== 'low').length > 0 && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{students.filter(s => s.riskLevel !== 'low').length}</Text>
                </View>
              )}
            </Pressable>
            <Pressable 
              style={[styles.actionCard, students.filter(s => s.debt > 0).length === 0 && styles.actionCardDisabled]} 
              onPress={handleCallDebtors}
            >
              <Ionicons name="call" size={24} color={students.filter(s => s.debt > 0).length > 0 ? "#F59E0B" : "#9CA3AF"} />
              <Text style={[styles.actionCardText, students.filter(s => s.debt > 0).length === 0 && styles.actionCardTextDisabled]}>
                Подзвонити боржникам
              </Text>
              {students.filter(s => s.debt > 0).length > 0 && (
                <View style={[styles.actionBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.actionBadgeText, { color: '#F59E0B' }]}>{students.filter(s => s.debt > 0).length}</Text>
                </View>
              )}
            </Pressable>
            <Pressable 
              style={[styles.actionCard, students.filter(s => s.lastVisitDays > 5).length === 0 && styles.actionCardDisabled]} 
              onPress={handleInviteAbsent}
            >
              <Ionicons name="person-add" size={24} color={students.filter(s => s.lastVisitDays > 5).length > 0 ? "#3B82F6" : "#9CA3AF"} />
              <Text style={[styles.actionCardText, students.filter(s => s.lastVisitDays > 5).length === 0 && styles.actionCardTextDisabled]}>
                Запросити відсутніх
              </Text>
              {students.filter(s => s.lastVisitDays > 5).length > 0 && (
                <View style={[styles.actionBadge, { backgroundColor: '#DBEAFE' }]}>
                  <Text style={[styles.actionBadgeText, { color: '#3B82F6' }]}>{students.filter(s => s.lastVisitDays > 5).length}</Text>
                </View>
              )}
            </Pressable>
            <Pressable style={styles.actionCard} onPress={handleLaunchPromotion}>
              <Ionicons name="megaphone" size={24} color="#22C55E" />
              <Text style={styles.actionCardText}>Запустити акцію</Text>
            </Pressable>
          </View>
        </View>

        {/* KPI BLOCK */}
        {health && (
          <View style={styles.kpiSection}>
            <Text style={styles.sectionTitle}>Показники</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <Text style={[styles.kpiValue, { color: health.attendance >= 80 ? '#22C55E' : '#F59E0B' }]}>
                  {health.attendance}%
                </Text>
                <Text style={styles.kpiLabel}>Attendance</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="trending-down" size={20} color={health.churn > 15 ? '#EF4444' : '#6B7280'} />
                <Text style={[styles.kpiValue, health.churn > 15 && { color: '#EF4444' }]}>
                  {health.churn}%
                </Text>
                <Text style={styles.kpiLabel}>Churn</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="repeat" size={20} color="#3B82F6" />
                <Text style={styles.kpiValue}>{health.retention}%</Text>
                <Text style={styles.kpiLabel}>Retention</Text>
              </View>
            </View>
          </View>
        )}

        {/* DYNAMICS */}
        {health && (
          <View style={styles.dynamicsSection}>
            <Text style={styles.sectionTitle}>Динаміка (4 тижні)</Text>
            <View style={styles.dynamicsGrid}>
              <View style={styles.dynamicCard}>
                <Text style={styles.dynamicLabel}>Attendance</Text>
                {renderTrendBar(health.dynamics.attendanceTrend, 100, '#22C55E')}
                <Text style={styles.dynamicChange}>
                  {health.dynamics.attendanceTrend[0]} → {health.dynamics.attendanceTrend[3]}
                </Text>
              </View>
              <View style={styles.dynamicCard}>
                <Text style={styles.dynamicLabel}>Churn</Text>
                {renderTrendBar(health.dynamics.churnTrend, 30, '#EF4444', true)}
                <Text style={[styles.dynamicChange, { color: '#EF4444' }]}>
                  {health.dynamics.churnTrend[0]} → {health.dynamics.churnTrend[3]} ↑
                </Text>
              </View>
            </View>
            {health.dynamics.trendReason && (
              <View style={styles.trendReasonCard}>
                <Ionicons name="information-circle" size={16} color="#6B7280" />
                <Text style={styles.trendReasonText}>{health.dynamics.trendReason}</Text>
              </View>
            )}
          </View>
        )}

        {/* SCHEDULE */}
        {schedule.length > 0 && (
          <View style={styles.scheduleSection}>
            <View style={styles.scheduleHeader}>
              <Text style={styles.sectionTitle}>Розклад</Text>
              <Pressable style={styles.editBtn}>
                <Text style={styles.editBtnText}>Редагувати</Text>
              </Pressable>
            </View>
            <View style={styles.scheduleCard}>
              <View style={styles.scheduleDays}>
                {schedule.map((s, i) => (
                  <View key={i} style={styles.scheduleDay}>
                    <Text style={styles.scheduleDayText}>{dayNames[s.dayOfWeek] || s.dayOfWeek}</Text>
                  </View>
                ))}
              </View>
              {schedule[0] && (
                <Text style={styles.scheduleTime}>{schedule[0].startTime}</Text>
              )}
            </View>
          </View>
        )}

        {/* TRAINING HISTORY */}
        {trainingHistory.length > 0 && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Останні тренування</Text>
            <View style={styles.historyList}>
              {trainingHistory.slice(0, 4).map((training, i) => (
                <View key={i} style={styles.historyItem}>
                  <Text style={styles.historyDate}>{training.date?.slice(5) || ''}</Text>
                  <View style={styles.historyStats}>
                    <Text style={styles.historyAttended}>✓ {training.attended}</Text>
                    <Text style={styles.historyAbsent}>✗ {training.absent}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* STUDENTS LIST */}
        <View style={styles.studentsSection}>
          <Text style={styles.sectionTitle}>Учні ({students.length})</Text>
          
          {/* Filters */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {[
              { key: 'all', label: 'Всі', count: students.length },
              { key: 'risk', label: 'Ризик', count: riskCount + warningCount },
              { key: 'debt', label: 'Борг', count: debtCount },
              { key: 'top', label: 'Топ', count: topCount },
            ].map((filter) => (
              <Pressable
                key={filter.key}
                style={[
                  styles.filterChip,
                  activeFilter === filter.key && styles.filterChipActive
                ]}
                onPress={() => setActiveFilter(filter.key as FilterType)}
              >
                <Text style={[
                  styles.filterChipText,
                  activeFilter === filter.key && styles.filterChipTextActive
                ]}>
                  {filter.label}
                </Text>
                {filter.count > 0 && (
                  <View style={[
                    styles.filterCount,
                    activeFilter === filter.key && styles.filterCountActive
                  ]}>
                    <Text style={[
                      styles.filterCountText,
                      activeFilter === filter.key && styles.filterCountTextActive
                    ]}>
                      {filter.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>

          {/* Students */}
          {filteredStudents.map((student) => (
            <Pressable
              key={student.id}
              style={styles.studentCard}
              onPress={() => router.push(`/coach/student/${student.id}`)}
            >
              <View style={[
                styles.riskIndicator,
                { backgroundColor: getRiskColor(student.riskLevel) }
              ]} />
              
              <View style={styles.studentInfo}>
                <View style={styles.studentNameRow}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  {/* Badges */}
                  {student.badges.map((badge, i) => (
                    <View 
                      key={i} 
                      style={[styles.badge, { backgroundColor: badge.color + '20' }]}
                    >
                      <Text style={[styles.badgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={styles.studentMeta}>
                  {student.belt && (
                    <View style={styles.beltBadge}>
                      <Text style={styles.beltText}>{student.belt}</Text>
                    </View>
                  )}
                  <Text style={[
                    styles.attendanceText,
                    { color: student.attendanceRate >= 80 ? '#22C55E' : 
                             student.attendanceRate >= 60 ? '#F59E0B' : '#EF4444' }
                  ]}>
                    {student.attendanceRate}%
                  </Text>
                  {student.debt > 0 && (
                    <Text style={styles.debtText}>
                      Борг: {student.debt} грн
                    </Text>
                  )}
                </View>
                {student.lastVisitDays > 5 && (
                  <Text style={styles.inactiveText}>
                    Не був {student.lastVisitDays} днів
                  </Text>
                )}
              </View>

              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </Pressable>
          ))}

          {filteredStudents.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={40} color="#22C55E" />
              <Text style={styles.emptyText}>Немає учнів з такими критеріями</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F7F7' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { padding: 4 },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F0F10', marginBottom: 12 },

  // Health Card
  healthCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
  },
  healthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  healthLabel: { fontSize: 14, color: '#6B7280', marginBottom: 4 },
  healthScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  healthScore: { fontSize: 48, fontWeight: '800' },
  healthBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  healthBadgeText: { fontSize: 14, fontWeight: '600' },
  impactBadge: { 
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, 
    flexDirection: 'row', alignItems: 'center', gap: 6 
  },
  impactText: { fontSize: 18, fontWeight: '800' },
  impactSubtext: { fontSize: 11, fontWeight: '600' },

  // Header
  headerCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 },
  headerCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerCardLeft: { flex: 1 },
  groupName: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  ageRange: { fontSize: 16, color: '#6B7280', marginTop: 4 },
  headerScoreBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerScoreValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  headerStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
  },
  headerStatLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  headerStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
  },
  headerScheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  headerScheduleText: {
    fontSize: 13,
    color: '#9CA3AF',
  },

  // Money Card
  moneyCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 },
  moneyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  moneyTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  moneyGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  moneyItem: { alignItems: 'center' },
  moneyLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  moneyValue: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  debtorsBtn: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    gap: 6, marginTop: 16, paddingVertical: 10, 
    backgroundColor: '#FEE2E2', borderRadius: 12 
  },
  debtorsBtnText: { fontSize: 14, fontWeight: '600', color: '#E30613' },

  // Capacity
  capacityCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 12 },
  capacityHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  capacityTitle: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  capacityContent: {},
  capacityMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  capacityNumbers: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  capacityPercent: { fontSize: 24, fontWeight: '800', color: '#3B82F6' },
  capacityBar: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  capacityBarFill: { height: '100%', backgroundColor: '#3B82F6', borderRadius: 4 },
  freeSlotsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  freeSlotsText: { fontSize: 14, color: '#6B7280' },
  inviteBtn: { 
    flexDirection: 'row', alignItems: 'center', gap: 4, 
    backgroundColor: '#3B82F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 
  },
  inviteBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  // Churn Alert
  churnCard: { backgroundColor: '#FEF3C7', borderRadius: 16, padding: 16, marginBottom: 12 },
  churnHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  churnTitle: { fontSize: 16, fontWeight: '700', color: '#92400E' },
  churnItem: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8 
  },
  churnItemLeft: {},
  churnName: { fontSize: 15, fontWeight: '600', color: '#0F0F10' },
  churnReason: { fontSize: 13, color: '#92400E', marginTop: 2 },
  resolveBtn: { backgroundColor: '#E30613', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 8 },
  resolveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Action Section
  actionSection: { marginBottom: 16 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8,
    position: 'relative',
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionCardText: { fontSize: 12, fontWeight: '600', color: '#374151', textAlign: 'center' },
  actionCardTextDisabled: { color: '#9CA3AF' },
  actionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#E30613',
  },

  // KPI Section
  kpiSection: { marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1, minWidth: '30%',
    backgroundColor: '#0F0F10', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8,
  },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#fff' },
  kpiLabel: { fontSize: 12, color: '#9CA3AF' },

  // Dynamics
  dynamicsSection: { marginBottom: 16 },
  dynamicsGrid: { flexDirection: 'row', gap: 10 },
  dynamicCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center' },
  dynamicLabel: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  dynamicChange: { fontSize: 12, color: '#6B7280', marginTop: 8 },
  trendBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 40 },
  trendBar: { width: 16, borderRadius: 4, minHeight: 4 },
  trendReasonCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F3F4F6', borderRadius: 12, padding: 12, marginTop: 12,
  },
  trendReasonText: { fontSize: 13, color: '#6B7280', flex: 1 },

  // Schedule
  scheduleSection: { marginBottom: 16 },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  editBtn: { backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  editBtnText: { fontSize: 13, color: '#6B7280', fontWeight: '600' },
  scheduleCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  scheduleDays: { flexDirection: 'row', gap: 8 },
  scheduleDay: { backgroundColor: '#E30613', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  scheduleDayText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scheduleTime: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },

  // History
  historySection: { marginBottom: 16 },
  historyList: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  historyItem: { alignItems: 'center' },
  historyDate: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  historyStats: { flexDirection: 'row', gap: 6 },
  historyAttended: { fontSize: 14, fontWeight: '600', color: '#22C55E' },
  historyAbsent: { fontSize: 14, fontWeight: '600', color: '#EF4444' },

  // Students
  studentsSection: { marginTop: 8 },
  filtersScroll: { marginBottom: 12, marginHorizontal: -16 },
  filtersContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    gap: 6, borderWidth: 1, borderColor: '#E5E7EB',
  },
  filterChipActive: { backgroundColor: '#E30613', borderColor: '#E30613' },
  filterChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  filterChipTextActive: { color: '#fff' },
  filterCount: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterCountText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterCountTextActive: { color: '#fff' },

  // Student Card
  studentCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 10,
    flexDirection: 'row', alignItems: 'center',
  },
  riskIndicator: { width: 4, height: 50, borderRadius: 2, marginRight: 14 },
  studentInfo: { flex: 1 },
  studentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  studentName: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  studentMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10, flexWrap: 'wrap' },
  beltBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  beltText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  attendanceText: { fontSize: 14, fontWeight: '600' },
  debtText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },
  inactiveText: { fontSize: 12, color: '#F59E0B', marginTop: 4 },

  // Empty
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderRadius: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', marginTop: 12 },
});
