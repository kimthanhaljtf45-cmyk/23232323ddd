import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { api } from '@/lib/api';

const PROGRAM_OPTIONS = [
  { value: 'KIDS', label: 'Дитяча' },
  { value: 'SPECIAL', label: 'Особлива' },
  { value: 'SELF_DEFENSE', label: 'Самооборона' },
  { value: 'MENTORSHIP', label: 'Персональні' },
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Чернетка', color: '#6B7280' },
  { value: 'OPEN', label: 'Відкрито', color: '#10B981' },
  { value: 'CLOSED', label: 'Закрито', color: '#F59E0B' },
  { value: 'FINISHED', label: 'Завершено', color: '#6B7280' },
];

export default function AdminCompetitionsScreen() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    programType: 'KIDS',
    registrationDeadline: '',
    hasFee: false,
    feeAmount: '',
  });

  const loadData = async () => {
    try {
      const [comps, statsData] = await Promise.all([
        api.getCompetitions(),
        api.getCompetitionStats(),
      ]);
      setCompetitions(comps || []);
      setStats(statsData);
    } catch (error) {
      console.log('Failed to load competitions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.date || !formData.location || !formData.registrationDeadline) {
      Alert.alert('Помилка', 'Заповніть всі обовʼязкові поля');
      return;
    }

    setCreating(true);
    try {
      await api.createCompetition({
        title: formData.title,
        description: formData.description || undefined,
        date: formData.date,
        location: formData.location,
        programType: formData.programType,
        registrationDeadline: formData.registrationDeadline,
        hasFee: formData.hasFee,
        feeAmount: formData.hasFee && formData.feeAmount ? parseInt(formData.feeAmount) : undefined,
      });
      Alert.alert('Успіх!', 'Змагання створено');
      setShowCreateModal(false);
      setFormData({
        title: '',
        description: '',
        date: '',
        location: '',
        programType: 'KIDS',
        registrationDeadline: '',
        hasFee: false,
        feeAmount: '',
      });
      await loadData();
    } catch (error: any) {
      Alert.alert('Помилка', error.response?.data?.message || 'Не вдалося створити змагання');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (competitionId: string, newStatus: string) => {
    try {
      await api.updateCompetition(competitionId, { status: newStatus });
      await loadData();
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося оновити статус');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('uk-UA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    return STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  };

  const renderCompetitionCard = ({ item }: { item: any }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/admin/competitions/${item._id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
          <TouchableOpacity style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.cardTitle}>{item.title}</Text>

        <View style={styles.infoRow}>
          <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>{formatDate(item.date)}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.infoText}>{item.location}</Text>
        </View>

        {item.hasFee && item.feeAmount && (
          <View style={styles.infoRow}>
            <Ionicons name="wallet-outline" size={14} color="#EF4444" />
            <Text style={[styles.infoText, { color: '#EF4444' }]}>{item.feeAmount} грн</Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          {item.status === 'DRAFT' && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: '#D1FAE5' }]}
              onPress={() => handleStatusChange(item._id, 'OPEN')}
            >
              <Text style={[styles.actionChipText, { color: '#10B981' }]}>Відкрити</Text>
            </TouchableOpacity>
          )}
          {item.status === 'OPEN' && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: '#FEF3C7' }]}
              onPress={() => handleStatusChange(item._id, 'CLOSED')}
            >
              <Text style={[styles.actionChipText, { color: '#D97706' }]}>Закрити реєстрацію</Text>
            </TouchableOpacity>
          )}
          {item.status === 'CLOSED' && (
            <TouchableOpacity
              style={[styles.actionChip, { backgroundColor: '#F3F4F6' }]}
              onPress={() => handleStatusChange(item._id, 'FINISHED')}
            >
              <Text style={[styles.actionChipText, { color: '#6B7280' }]}>Завершити</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Змагання</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Всього</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.open}</Text>
            <Text style={styles.statLabel}>Відкрито</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.totalParticipants}</Text>
            <Text style={styles.statLabel}>Учасників</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.medals?.gold || 0}</Text>
            <Text style={styles.statLabel}>Золото</Text>
          </View>
        </View>
      )}

      {/* List */}
      <FlatList
        data={competitions}
        keyExtractor={(item) => item._id}
        renderItem={renderCompetitionCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Змагань немає</Text>
            <Text style={styles.emptyText}>Створіть перше змагання</Text>
          </View>
        }
      />

      {/* Create Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Нове змагання</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Title */}
              <Text style={styles.inputLabel}>Назва *</Text>
              <TextInput
                style={styles.input}
                value={formData.title}
                onChangeText={(text) => setFormData({ ...formData, title: text })}
                placeholder="Кубок АТАКА 2026"
                placeholderTextColor={colors.textTertiary}
              />

              {/* Description */}
              <Text style={styles.inputLabel}>Опис</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Опис змагання..."
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />

              {/* Date */}
              <Text style={styles.inputLabel}>Дата * (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={formData.date}
                onChangeText={(text) => setFormData({ ...formData, date: text })}
                placeholder="2026-05-15"
                placeholderTextColor={colors.textTertiary}
              />

              {/* Location */}
              <Text style={styles.inputLabel}>Місце *</Text>
              <TextInput
                style={styles.input}
                value={formData.location}
                onChangeText={(text) => setFormData({ ...formData, location: text })}
                placeholder="Спортзал АТАКА"
                placeholderTextColor={colors.textTertiary}
              />

              {/* Program Type */}
              <Text style={styles.inputLabel}>Програма *</Text>
              <View style={styles.programOptions}>
                {PROGRAM_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.programOption,
                      formData.programType === opt.value && styles.programOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, programType: opt.value })}
                  >
                    <Text
                      style={[
                        styles.programOptionText,
                        formData.programType === opt.value && styles.programOptionTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Registration Deadline */}
              <Text style={styles.inputLabel}>Реєстрація до * (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={formData.registrationDeadline}
                onChangeText={(text) => setFormData({ ...formData, registrationDeadline: text })}
                placeholder="2026-05-10"
                placeholderTextColor={colors.textTertiary}
              />

              {/* Fee Toggle */}
              <View style={styles.switchRow}>
                <Text style={styles.inputLabel}>Внесок за участь</Text>
                <Switch
                  value={formData.hasFee}
                  onValueChange={(value) => setFormData({ ...formData, hasFee: value })}
                  trackColor={{ false: '#E5E7EB', true: colors.primary }}
                  thumbColor="#fff"
                />
              </View>

              {/* Fee Amount */}
              {formData.hasFee && (
                <>
                  <Text style={styles.inputLabel}>Сума внеску (грн)</Text>
                  <TextInput
                    style={styles.input}
                    value={formData.feeAmount}
                    onChangeText={(text) => setFormData({ ...formData, feeAmount: text.replace(/[^0-9]/g, '') })}
                    placeholder="500"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="numeric"
                  />
                </>
              )}

              {/* Spacer */}
              <View style={{ height: 20 }} />
            </ScrollView>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Створити</Text>
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
    fontWeight: '700',
    color: colors.text,
    marginLeft: 12,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    gap: 8,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuButton: {
    padding: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  quickActions: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    gap: 8,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  modalScroll: {
    padding: 20,
    maxHeight: 500,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  programOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  programOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  programOptionActive: {
    backgroundColor: colors.primary + '10',
    borderColor: colors.primary,
  },
  programOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  programOptionTextActive: {
    color: colors.primary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  submitButton: {
    backgroundColor: colors.primary,
    margin: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
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
