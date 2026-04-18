import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

const PROGRAM_LABELS: Record<string, string> = {
  KIDS: 'Дитяча програма',
  SPECIAL: 'Особлива програма',
  SELF_DEFENSE: 'Самооборона',
  MENTORSHIP: 'Персональні',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  DRAFT: { label: 'Чернетка', color: '#6B7280', bgColor: '#F3F4F6' },
  OPEN: { label: 'Реєстрація відкрита', color: '#10B981', bgColor: '#D1FAE5' },
  CLOSED: { label: 'Реєстрацію закрито', color: '#F59E0B', bgColor: '#FEF3C7' },
  FINISHED: { label: 'Завершено', color: '#6B7280', bgColor: '#F3F4F6' },
};

const MEDAL_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  GOLD: { icon: 'medal', color: '#F59E0B', label: 'Золото' },
  SILVER: { icon: 'medal', color: '#9CA3AF', label: 'Срібло' },
  BRONZE: { icon: 'medal', color: '#B45309', label: 'Бронза' },
  PARTICIPATION: { icon: 'ribbon', color: '#6B7280', label: 'Участь' },
};

export default function CompetitionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, children } = useStore();

  const [competition, setCompetition] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [category, setCategory] = useState('');

  const loadCompetition = async () => {
    try {
      const data = await api.getCompetition(id!);
      setCompetition(data);
    } catch (error) {
      console.log('Failed to load competition:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCompetition();
    }, [id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCompetition();
    setRefreshing(false);
  };

  const handleJoin = async () => {
    if (!selectedChild) {
      Alert.alert('Помилка', 'Оберіть учня');
      return;
    }

    setJoining(true);
    try {
      await api.joinCompetition(id!, {
        childId: selectedChild,
        category: category || undefined,
      });
      Alert.alert('Успіх!', 'Ви успішно зареєструвалися на змагання');
      setShowJoinModal(false);
      await loadCompetition();
    } catch (error: any) {
      const message = error.response?.data?.message || 'Не вдалося зареєструватися';
      Alert.alert('Помилка', message);
    } finally {
      setJoining(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isRegistered = (childId: string) => {
    return competition?.participants?.some((p: any) => p.childId === childId);
  };

  const canJoin = competition?.status === 'OPEN';
  const hasResults = competition?.results?.length > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!competition) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.errorText}>Змагання не знайдено</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = STATUS_CONFIG[competition.status] || STATUS_CONFIG.DRAFT;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {competition.title}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <Text style={styles.title}>{competition.title}</Text>
          {competition.description && (
            <Text style={styles.description}>{competition.description}</Text>
          )}
        </View>

        {/* Info Cards */}
        <View style={styles.infoCardsContainer}>
          <View style={styles.infoCard}>
            <Ionicons name="calendar" size={24} color={colors.primary} />
            <Text style={styles.infoCardLabel}>Дата</Text>
            <Text style={styles.infoCardValue}>{formatDate(competition.date)}</Text>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="location" size={24} color={colors.primary} />
            <Text style={styles.infoCardLabel}>Місце</Text>
            <Text style={styles.infoCardValue}>{competition.location}</Text>
          </View>
        </View>

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Програма</Text>
            <Text style={styles.detailValue}>
              {PROGRAM_LABELS[competition.programType] || competition.programType}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Реєстрація до</Text>
            <Text style={styles.detailValue}>
              {formatDate(competition.registrationDeadline)}
            </Text>
          </View>

          {competition.hasFee && competition.feeAmount && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Внесок</Text>
              <Text style={[styles.detailValue, { color: '#EF4444', fontWeight: '700' }]}>
                {competition.feeAmount} грн
              </Text>
            </View>
          )}
        </View>

        {/* Stats Section */}
        {competition.stats && (
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Статистика</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{competition.stats.totalParticipants}</Text>
                <Text style={styles.statLabel}>Учасників</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#10B981' }]}>
                  {competition.stats.confirmed}
                </Text>
                <Text style={styles.statLabel}>Підтверджено</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statValue, { color: '#F59E0B' }]}>
                  {competition.stats.pending}
                </Text>
                <Text style={styles.statLabel}>Очікує</Text>
              </View>
            </View>
          </View>
        )}

        {/* Results Section */}
        {hasResults && (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionTitle}>Результати</Text>
            {competition.results.map((result: any) => {
              const medalConfig = MEDAL_ICONS[result.medal] || MEDAL_ICONS.PARTICIPATION;
              const child = competition.participants?.find(
                (p: any) => p.childId === result.childId
              )?.child;

              return (
                <View key={result._id || result.childId} style={styles.resultCard}>
                  <View style={[styles.medalBadge, { backgroundColor: medalConfig.color + '20' }]}>
                    <Ionicons
                      name={medalConfig.icon as any}
                      size={24}
                      color={medalConfig.color}
                    />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultName}>
                      {child?.firstName || 'Учасник'} {child?.lastName || ''}
                    </Text>
                    <Text style={styles.resultMedal}>
                      {result.place} місце • {medalConfig.label}
                    </Text>
                    {result.awardType && (
                      <Text style={styles.resultAward}>{result.awardType}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Participants Section */}
        {competition.participants?.length > 0 && (
          <View style={styles.participantsSection}>
            <Text style={styles.sectionTitle}>
              Учасники ({competition.participants.length})
            </Text>
            {competition.participants.slice(0, 5).map((participant: any) => (
              <View key={participant._id} style={styles.participantCard}>
                <View style={styles.participantAvatar}>
                  <Ionicons name="person" size={20} color={colors.textSecondary} />
                </View>
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {participant.child?.firstName || 'Учасник'}
                  </Text>
                  <Text style={styles.participantStatus}>
                    {participant.status === 'CONFIRMED'
                      ? 'Підтверджено'
                      : participant.status === 'PENDING'
                      ? 'Очікує'
                      : 'Відхилено'}
                  </Text>
                </View>
                {participant.paid && (
                  <View style={styles.paidBadge}>
                    <Ionicons name="checkmark" size={14} color="#10B981" />
                    <Text style={styles.paidText}>Оплачено</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Spacer for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Join Button */}
      {canJoin && user && (user.role === 'PARENT' || user.role === 'STUDENT') && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.joinButton}
            onPress={() => setShowJoinModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.joinButtonText}>Взяти участь</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Join Modal */}
      <Modal
        visible={showJoinModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Реєстрація на змагання</Text>
              <TouchableOpacity onPress={() => setShowJoinModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Child Selection */}
            <Text style={styles.modalLabel}>Оберіть учня</Text>
            {children.map((child) => {
              const alreadyRegistered = isRegistered(child.id);
              return (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childOption,
                    selectedChild === child.id && styles.childOptionSelected,
                    alreadyRegistered && styles.childOptionDisabled,
                  ]}
                  onPress={() => !alreadyRegistered && setSelectedChild(child.id)}
                  disabled={alreadyRegistered}
                >
                  <Text style={styles.childOptionName}>{child.firstName}</Text>
                  {alreadyRegistered && (
                    <Text style={styles.registeredText}>Вже зареєстровано</Text>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Category Input */}
            <Text style={[styles.modalLabel, { marginTop: 16 }]}>
              Категорія (опціонально)
            </Text>
            <TextInput
              style={styles.categoryInput}
              value={category}
              onChangeText={setCategory}
              placeholder="напр. 8-10 років, 30-35 кг"
              placeholderTextColor={colors.textTertiary}
            />

            {/* Fee Warning */}
            {competition.hasFee && competition.feeAmount && (
              <View style={styles.feeWarning}>
                <Ionicons name="wallet-outline" size={18} color="#F59E0B" />
                <Text style={styles.feeWarningText}>
                  Внесок: {competition.feeAmount} грн
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, !selectedChild && styles.submitButtonDisabled]}
              onPress={handleJoin}
              disabled={!selectedChild || joining}
            >
              {joining ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Зареєструватися</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroSection: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  infoCardsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  infoCardLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  infoCardValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 4,
    textAlign: 'center',
  },
  detailsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  statsSection: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  resultsSection: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  medalBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  resultMedal: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultAward: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 2,
  },
  participantsSection: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
  },
  participantAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  participantInfo: {
    flex: 1,
    marginLeft: 10,
  },
  participantName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  participantStatus: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  paidText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  joinButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  childOption: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  childOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  childOptionDisabled: {
    opacity: 0.5,
  },
  childOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  registeredText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
  categoryInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
  },
  feeWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    gap: 8,
  },
  feeWarningText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
