import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../../src/lib/api';

/**
 * STUDENT DETAIL - ЯДРО СИСТЕМИ УПРАВЛІННЯ
 * 
 * Повний екран аналітики учня з:
 * - Status + Risk Score
 * - KPI Block
 * - Action Center
 * - Attendance History (візуальний)
 * - Trend з MetaBrain поясненням
 * - Progress Block
 * - Payment Block
 * - MetaBrain Recommendation
 */

interface StudentAnalytics {
  attendanceRate: number;
  lastVisitDays: number;
  riskScore: number;
  riskLevel: 'low' | 'warning' | 'critical';
  debt: number;
  progressScore: number;
  streak: number;
  missedInRow: number;
  totalTrainings: number;
  attendedTrainings: number;
  attendanceHistory: Array<{ date: string; status: 'present' | 'absent' | 'late' }>;
  trend: 'up' | 'down' | 'stable';
  trendReason?: string;
  coachScoreImpact: number;
  badges: Array<{ type: string; label: string; color: string }>;
}

interface Recommendation {
  title: string;
  description: string;
  actions: string[];
}

export default function StudentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [student, setStudent] = useState<any>(null);
  const [parent, setParent] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [ltv, setLtv] = useState<any>(null);
  const [actionHistory, setActionHistory] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [studentRes, ltvRes] = await Promise.all([
        api.get(`/coach/students/${id}`),
        api.get(`/ltv/student/${id}`).catch(() => null),
      ]);
      const sData = studentRes?.data || studentRes;
      setStudent(sData?.student);
      setParent(sData?.parent);
      setProgress(sData?.progress);
      setAnalytics(sData?.analytics);
      setRecommendation(sData?.recommendation);
      setActionHistory(sData?.actionHistory || []);
      const lData = ltvRes?.data || ltvRes;
      setLtv(lData);
    } catch (error) {
      console.log('Error fetching student:', error);
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

  const handleCall = () => {
    if (parent?.phone) {
      Linking.openURL(`tel:${parent.phone}`);
    }
  };

  const handleMessage = () => {
    router.push(`/messages/new?parentId=${id}`);
  };

  const handleInvite = () => {
    // TODO: Send invite message
    console.log('Invite to training');
  };

  const handlePaymentReminder = () => {
    // TODO: Send payment reminder
    console.log('Payment reminder');
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return '#22C55E';
      case 'warning': return '#F59E0B';
      case 'critical': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getRiskText = (level: string) => {
    switch (level) {
      case 'low': return 'СТАБІЛЬНИЙ';
      case 'warning': return 'ПОТРЕБУЄ УВАГИ';
      case 'critical': return 'ВИСОКИЙ РИЗИК';
      default: return '';
    }
  };

  const getTrendIcon = (trend: string): keyof typeof Ionicons.glyphMap => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#22C55E';
      case 'down': return '#EF4444';
      default: return '#6B7280';
    }
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

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Учень',
          headerShown: true,
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
      >
        {/* HEADER */}
        <View style={styles.headerCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarText}>
              {student?.name?.split(' ').map((n: string) => n[0]).join('') || '??'}
            </Text>
          </View>
          <Text style={styles.studentName}>{student?.name}</Text>
          <Text style={styles.studentAge}>{student?.age} років</Text>
          
          <View style={styles.infoTags}>
            <View style={styles.infoTag}>
              <Ionicons name="ribbon" size={14} color="#6B7280" />
              <Text style={styles.infoTagText}>Пояс: {student?.belt || 'Білий'}</Text>
            </View>
            <View style={styles.infoTag}>
              <Ionicons name="people" size={14} color="#6B7280" />
              <Text style={styles.infoTagText}>{student?.groupName}</Text>
            </View>
            <View style={styles.infoTag}>
              <Ionicons name="location" size={14} color="#6B7280" />
              <Text style={styles.infoTagText}>{student?.clubName || 'АТАКА'}</Text>
            </View>
          </View>
        </View>

        {/* STATUS + RISK */}
        {analytics && (
          <View style={[
            styles.riskCard, 
            { borderColor: getRiskColor(analytics.riskLevel) }
          ]}>
            <View style={styles.riskHeader}>
              <View style={[
                styles.riskBadge, 
                { backgroundColor: getRiskColor(analytics.riskLevel) }
              ]}>
                <Text style={styles.riskBadgeText}>
                  {getRiskText(analytics.riskLevel)}
                </Text>
              </View>
              <Text style={[styles.riskScore, { color: getRiskColor(analytics.riskLevel) }]}>
                {analytics.riskScore}
              </Text>
            </View>
            
            {analytics.riskLevel !== 'low' && (
              <View style={styles.riskReasons}>
                <Text style={styles.riskReasonsTitle}>Причини:</Text>
                {analytics.lastVisitDays > 5 && (
                  <Text style={styles.riskReasonItem}>• не був {analytics.lastVisitDays} днів</Text>
                )}
                {analytics.attendanceRate < 60 && (
                  <Text style={styles.riskReasonItem}>• attendance {analytics.attendanceRate}%</Text>
                )}
                {analytics.debt > 0 && (
                  <Text style={styles.riskReasonItem}>• є борг {analytics.debt} грн</Text>
                )}
                {analytics.missedInRow >= 2 && (
                  <Text style={styles.riskReasonItem}>• {analytics.missedInRow} пропусків підряд</Text>
                )}
              </View>
            )}
            
            {analytics.coachScoreImpact !== 0 && (
              <View style={styles.impactRow}>
                <Ionicons name="analytics" size={14} color="#6B7280" />
                <Text style={styles.impactText}>
                  {analytics.coachScoreImpact > 0 ? '+' : ''}{analytics.coachScoreImpact} до Coach Score
                </Text>
              </View>
            )}
          </View>
        )}

        {/* KPI BLOCK */}
        {analytics && (
          <View style={styles.kpiSection}>
            <Text style={styles.sectionTitle}>Показники</Text>
            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <Text style={[
                  styles.kpiValue,
                  { color: analytics.attendanceRate >= 80 ? '#22C55E' : 
                           analytics.attendanceRate >= 60 ? '#F59E0B' : '#EF4444' }
                ]}>
                  {analytics.attendanceRate}%
                </Text>
                <Text style={styles.kpiLabel}>Attendance</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="calendar" size={20} color="#6B7280" />
                <Text style={[
                  styles.kpiValue,
                  analytics.lastVisitDays > 5 && { color: '#F59E0B' }
                ]}>
                  {analytics.lastVisitDays}
                </Text>
                <Text style={styles.kpiLabel}>Днів без візиту</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="wallet" size={20} color={analytics.debt > 0 ? '#EF4444' : '#22C55E'} />
                <Text style={[
                  styles.kpiValue,
                  { color: analytics.debt > 0 ? '#EF4444' : '#22C55E' }
                ]}>
                  {analytics.debt > 0 ? analytics.debt + '₴' : 'OK'}
                </Text>
                <Text style={styles.kpiLabel}>Борг</Text>
              </View>
              <View style={styles.kpiCard}>
                <Ionicons name="trending-up" size={20} color="#3B82F6" />
                <Text style={styles.kpiValue}>{analytics.progressScore || 0}%</Text>
                <Text style={styles.kpiLabel}>Прогрес</Text>
              </View>
            </View>
          </View>
        )}

        {/* ACTION CENTER */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>Дії</Text>
          <View style={styles.actionGrid}>
            <Pressable style={styles.actionBtn} onPress={handleMessage}>
              <Ionicons name="chatbubble" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Написати батькам</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleCall}>
              <Ionicons name="call" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Подзвонити</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionBtnBlue]} onPress={handleInvite}>
              <Ionicons name="fitness" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Запросити на тренування</Text>
            </Pressable>
            {analytics && analytics.debt > 0 && (
              <Pressable style={[styles.actionBtn, styles.actionBtnYellow]} onPress={handlePaymentReminder}>
                <Ionicons name="card" size={20} color="#fff" />
                <Text style={styles.actionBtnText}>Нагадати про оплату</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ATTENDANCE HISTORY */}
        {analytics && analytics.attendanceHistory.length > 0 && (
          <View style={styles.attendanceSection}>
            <Text style={styles.sectionTitle}>Історія відвідувань</Text>
            <View style={styles.attendanceCard}>
              <View style={styles.attendanceRow}>
                <Text style={styles.attendanceLabel}>Останні 10:</Text>
                <View style={styles.attendanceIcons}>
                  {analytics.attendanceHistory.map((item, i) => (
                    <View 
                      key={i} 
                      style={[
                        styles.attendanceIcon,
                        { backgroundColor: item.status === 'present' ? '#22C55E' : 
                                          item.status === 'late' ? '#F59E0B' : '#EF4444' }
                      ]}
                    >
                      <Text style={styles.attendanceIconText}>
                        {item.status === 'present' ? '✓' : '✗'}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.attendanceStats}>
                <Text style={styles.attendancePercent}>{analytics.attendanceRate}%</Text>
                <Text style={styles.attendanceCount}>
                  {analytics.attendedTrainings} / {analytics.totalTrainings} тренувань
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* TREND */}
        {analytics && (
          <View style={styles.trendSection}>
            <Text style={styles.sectionTitle}>Тренд</Text>
            <View style={styles.trendCard}>
              <View style={styles.trendMain}>
                <Ionicons 
                  name={getTrendIcon(analytics.trend)} 
                  size={32} 
                  color={getTrendColor(analytics.trend)} 
                />
                <Text style={[styles.trendText, { color: getTrendColor(analytics.trend) }]}>
                  {analytics.trend === 'up' ? 'Покращується' : 
                   analytics.trend === 'down' ? 'Погіршується' : 'Стабільно'}
                </Text>
              </View>
              {analytics.trendReason && (
                <View style={styles.trendReason}>
                  <Ionicons name="information-circle" size={16} color="#6B7280" />
                  <Text style={styles.trendReasonText}>{analytics.trendReason}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* PROGRESS */}
        {progress && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Прогрес</Text>
            <View style={styles.progressCard}>
              <View style={styles.beltProgress}>
                <Text style={styles.beltLabel}>Пояс:</Text>
                <View style={styles.beltRow}>
                  <Text style={styles.currentBelt}>{progress.currentBelt || 'Білий'}</Text>
                  <Ionicons name="arrow-forward" size={16} color="#6B7280" />
                  <Text style={styles.nextBelt}>{progress.nextBelt || 'Жовтий'}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressBarFill,
                      { width: `${progress.progressPercent || 0}%` }
                    ]} 
                  />
                </View>
                <Text style={styles.progressPercent}>{progress.progressPercent || 0}%</Text>
              </View>
              
              {progress.totalMedals > 0 && (
                <View style={styles.achievements}>
                  <Ionicons name="medal" size={20} color="#F59E0B" />
                  <Text style={styles.achievementText}>
                    {progress.totalMedals} медалей
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* PARENT INFO */}
        {parent && (
          <View style={styles.parentSection}>
            <Text style={styles.sectionTitle}>Батьки</Text>
            <View style={styles.parentCard}>
              <Ionicons name="person" size={20} color="#6B7280" />
              <View style={styles.parentInfo}>
                <Text style={styles.parentName}>{parent.name}</Text>
                <Text style={styles.parentPhone}>{parent.phone}</Text>
              </View>
            </View>
          </View>
        )}

        {/* LTV BLOCK */}
        {ltv && (
          <View style={styles.ltvSection}>
            <Text style={styles.sectionTitle}>💰 LTV (Lifetime Value)</Text>
            <View style={styles.ltvCard}>
              <View style={styles.ltvMain}>
                <View style={styles.ltvItem}>
                  <Text style={styles.ltvLabel}>Було оплачено</Text>
                  <Text style={styles.ltvValue}>{(ltv.ltvActual || 0).toLocaleString()} ₴</Text>
                </View>
                <View style={styles.ltvItem}>
                  <Text style={styles.ltvLabel}>Прогноз</Text>
                  <Text style={[styles.ltvValue, { color: '#3B82F6' }]}>
                    {(ltv.ltvPredicted || 0).toLocaleString()} ₴
                  </Text>
                </View>
              </View>
              <View style={styles.ltvDivider} />
              <View style={styles.ltvTotal}>
                <Text style={styles.ltvTotalLabel}>Загальний LTV</Text>
                <Text style={styles.ltvTotalValue}>{(ltv.ltvTotal || 0).toLocaleString()} ₴</Text>
              </View>
              <View style={styles.ltvDetails}>
                <View style={styles.ltvDetailItem}>
                  <Ionicons name="calendar" size={14} color="#6B7280" />
                  <Text style={styles.ltvDetailText}>
                    Активний {ltv.monthsActive || 1} міс.
                  </Text>
                </View>
                <View style={styles.ltvDetailItem}>
                  <Ionicons name="trending-down" size={14} color={ltv.churnProbability > 50 ? '#EF4444' : '#22C55E'} />
                  <Text style={[
                    styles.ltvDetailText,
                    { color: ltv.churnProbability > 50 ? '#EF4444' : '#22C55E' }
                  ]}>
                    Ризик відтоку: {ltv.churnProbability || 0}%
                  </Text>
                </View>
                <View style={styles.ltvDetailItem}>
                  <Ionicons name="time" size={14} color="#6B7280" />
                  <Text style={styles.ltvDetailText}>
                    Прогноз: ще {ltv.predictedMonthsLeft || 1} міс.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* METABRAIN RECOMMENDATION */}
        {recommendation && (
          <View style={styles.recommendationSection}>
            <View style={styles.recommendationCard}>
              <View style={styles.recommendationHeader}>
                <Ionicons name="bulb" size={20} color="#3B82F6" />
                <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
              </View>
              <Text style={styles.recommendationDescription}>
                {recommendation.description}
              </Text>
              {recommendation.actions.length > 0 && (
                <View style={styles.recommendationActions}>
                  {recommendation.actions.map((action, i) => (
                    <View key={i} style={styles.recommendationAction}>
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      <Text style={styles.recommendationActionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ACTION HISTORY — Історія дій */}
        {actionHistory.length > 0 && (
          <View style={styles.actionHistorySection}>
            <Text style={styles.sectionTitle}>Історія дій</Text>
            {actionHistory.map((action: any) => {
              const isDone = action.status === 'DONE' || action.status === 'COMPLETED';
              return (
                <View key={action.id} style={styles.actionHistoryItem}>
                  <View style={[
                    styles.actionHistoryDot,
                    { backgroundColor: isDone ? '#22C55E' : action.severity === 'critical' ? '#EF4444' : '#F59E0B' },
                  ]} />
                  <View style={styles.actionHistoryContent}>
                    <View style={styles.actionHistoryTop}>
                      <Text style={[styles.actionHistoryTitle, isDone && styles.actionHistoryTitleDone]}>
                        {action.title}
                      </Text>
                      <View style={[
                        styles.actionHistoryStatus,
                        isDone ? styles.actionHistoryStatusDone : styles.actionHistoryStatusPending,
                      ]}>
                        <Text style={[
                          styles.actionHistoryStatusText,
                          isDone ? styles.actionHistoryStatusTextDone : styles.actionHistoryStatusTextPending,
                        ]}>
                          {isDone ? 'DONE' : 'PENDING'}
                        </Text>
                      </View>
                    </View>
                    {action.message && (
                      <Text style={styles.actionHistoryMessage}>{action.message}</Text>
                    )}
                    <Text style={styles.actionHistoryDate}>
                      {action.createdAt ? new Date(action.createdAt).toLocaleDateString('uk-UA') : ''}
                      {action.completedAt ? ` → ${new Date(action.completedAt).toLocaleDateString('uk-UA')}` : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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

  // Header
  headerCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 16,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#374151' },
  studentName: { fontSize: 24, fontWeight: '800', color: '#111' },
  studentAge: { fontSize: 16, color: '#666', marginTop: 4 },
  infoTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16 },
  infoTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
  },
  infoTagText: { fontSize: 13, color: '#6B7280' },

  // Risk Card
  riskCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 2,
  },
  riskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  riskBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  riskBadgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  riskScore: { fontSize: 40, fontWeight: '800' },
  riskReasons: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  riskReasonsTitle: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  riskReasonItem: { fontSize: 14, color: '#374151', marginBottom: 4 },
  impactRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  impactText: { fontSize: 13, color: '#6B7280' },

  // KPI
  kpiSection: { marginBottom: 16 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', gap: 6,
  },
  kpiValue: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  kpiLabel: { fontSize: 12, color: '#6B7280' },

  // Actions
  actionSection: { marginBottom: 16 },
  actionGrid: { gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0F0F10', paddingVertical: 14, borderRadius: 14, gap: 8,
  },
  actionBtnDanger: { backgroundColor: '#E30613' },
  actionBtnBlue: { backgroundColor: '#3B82F6' },
  actionBtnYellow: { backgroundColor: '#F59E0B' },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Attendance
  attendanceSection: { marginBottom: 16 },
  attendanceCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  attendanceRow: { marginBottom: 12 },
  attendanceLabel: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  attendanceIcons: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  attendanceIcon: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  attendanceIconText: { fontSize: 14, color: '#fff', fontWeight: '600' },
  attendanceStats: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  attendancePercent: { fontSize: 24, fontWeight: '800', color: '#0F0F10' },
  attendanceCount: { fontSize: 14, color: '#6B7280' },

  // Trend
  trendSection: { marginBottom: 16 },
  trendCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  trendMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trendText: { fontSize: 18, fontWeight: '700' },
  trendReason: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  trendReasonText: { fontSize: 14, color: '#6B7280', flex: 1 },

  // Progress
  progressSection: { marginBottom: 16 },
  progressCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  beltProgress: {},
  beltLabel: { fontSize: 13, color: '#6B7280', marginBottom: 8 },
  beltRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  currentBelt: { fontSize: 18, fontWeight: '700', color: '#0F0F10' },
  nextBelt: { fontSize: 18, fontWeight: '700', color: '#6B7280' },
  progressBar: {
    height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden', marginTop: 12,
  },
  progressBarFill: { height: '100%', backgroundColor: '#22C55E', borderRadius: 4 },
  progressPercent: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  achievements: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  achievementText: { fontSize: 16, fontWeight: '600', color: '#0F0F10' },

  // Parent
  parentSection: { marginBottom: 16 },
  parentCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  parentInfo: { flex: 1 },
  parentName: { fontSize: 16, fontWeight: '600', color: '#111' },
  parentPhone: { fontSize: 14, color: '#666', marginTop: 4 },

  // Recommendation
  recommendationSection: { marginBottom: 16 },
  recommendationCard: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16 },
  recommendationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  recommendationTitle: { fontSize: 16, fontWeight: '700', color: '#1E40AF' },
  recommendationDescription: { fontSize: 14, color: '#374151', lineHeight: 22 },
  recommendationActions: { marginTop: 12 },
  recommendationAction: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  recommendationActionText: { fontSize: 14, color: '#374151' },

  // LTV Section
  ltvSection: { marginBottom: 16 },
  ltvCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  ltvMain: { flexDirection: 'row', justifyContent: 'space-between' },
  ltvItem: { alignItems: 'center' },
  ltvLabel: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  ltvValue: { fontSize: 20, fontWeight: '700', color: '#0F0F10' },
  ltvDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },
  ltvTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ltvTotalLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  ltvTotalValue: { fontSize: 24, fontWeight: '800', color: '#22C55E' },
  ltvDetails: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  ltvDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  ltvDetailText: { fontSize: 13, color: '#6B7280' },

  // Action History
  actionHistorySection: { marginBottom: 16 },
  actionHistoryItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  actionHistoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    marginRight: 12,
  },
  actionHistoryContent: { flex: 1 },
  actionHistoryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionHistoryTitle: { fontSize: 14, fontWeight: '600', color: '#0F0F10', flex: 1 },
  actionHistoryTitleDone: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  actionHistoryStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  actionHistoryStatusDone: { backgroundColor: '#D1FAE5' },
  actionHistoryStatusPending: { backgroundColor: '#FEF3C7' },
  actionHistoryStatusText: { fontSize: 10, fontWeight: '800' },
  actionHistoryStatusTextDone: { color: '#065F46' },
  actionHistoryStatusTextPending: { color: '#92400E' },
  actionHistoryMessage: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  actionHistoryDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
});
