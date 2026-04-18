import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';
import { format, parseISO } from 'date-fns';
import { uk } from 'date-fns/locale';

function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return '#22C55E';
    case 'PAUSED': return '#F59E0B';
    case 'CANCELLED': return '#EF4444';
    default: return '#6B7280';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'Активна';
    case 'PAUSED': return 'Призупинена';
    case 'CANCELLED': return 'Скасована';
    default: return status;
  }
}

export default function SubscriptionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', id],
    queryFn: () => api.getSubscription(id || ''),
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data: { status: string }) => api.updateSubscription(id || '', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', id] });
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    },
    onError: () => {
      Alert.alert('Помилка', 'Не вдалося оновити підписку');
    },
  });

  const handlePause = () => {
    Alert.alert(
      'Призупинити підписку?',
      'Ви зможете поновити її будь-коли',
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Призупинити', onPress: () => updateMutation.mutate({ status: 'PAUSED' }) },
      ]
    );
  };

  const handleResume = () => {
    updateMutation.mutate({ status: 'ACTIVE' });
  };

  const handleCancel = () => {
    Alert.alert(
      'Скасувати підписку?',
      'Цю дію не можна скасувати',
      [
        { text: 'Ні', style: 'cancel' },
        { text: 'Так, скасувати', style: 'destructive', onPress: () => updateMutation.mutate({ status: 'CANCELLED' }) },
      ]
    );
  };

  if (isLoading || !subscription) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#E30613" />
      </SafeAreaView>
    );
  }

  const nextDate = subscription.nextBillingDate ? parseISO(subscription.nextBillingDate) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Підписка</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusIcon, { backgroundColor: getStatusColor(subscription.status) + '20' }]}>
            <Ionicons 
              name={subscription.status === 'ACTIVE' ? 'card' : subscription.status === 'PAUSED' ? 'pause' : 'close'} 
              size={32} 
              color={getStatusColor(subscription.status)} 
            />
          </View>
          <Text style={styles.planName}>{subscription.planName}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(subscription.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(subscription.status) }]}>
              {getStatusText(subscription.status)}
            </Text>
          </View>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Дитина</Text>
            <Text style={styles.detailValue}>
              {subscription.childId?.firstName} {subscription.childId?.lastName}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Ціна</Text>
            <Text style={styles.detailValue}>{subscription.price} грн/міс</Text>
          </View>
          {nextDate && subscription.status === 'ACTIVE' && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Наступна оплата</Text>
              <Text style={styles.detailValue}>
                {format(nextDate, 'd MMMM yyyy', { locale: uk })}
              </Text>
            </View>
          )}
        </View>

        {/* Actions */}
        {subscription.status !== 'CANCELLED' && (
          <View style={styles.actionsCard}>
            <Text style={styles.actionsTitle}>Управління</Text>
            
            {subscription.status === 'ACTIVE' && (
              <TouchableOpacity style={styles.actionButton} onPress={handlePause}>
                <Ionicons name="pause-circle-outline" size={24} color="#F59E0B" />
                <Text style={styles.actionButtonText}>Призупинити підписку</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            {subscription.status === 'PAUSED' && (
              <TouchableOpacity style={styles.actionButton} onPress={handleResume}>
                <Ionicons name="play-circle-outline" size={24} color="#22C55E" />
                <Text style={styles.actionButtonText}>Поновити підписку</Text>
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.actionButton, styles.actionButtonDanger]} onPress={handleCancel}>
              <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
              <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Скасувати підписку</Text>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {subscription.status === 'CANCELLED' && (
          <View style={styles.cancelledCard}>
            <Ionicons name="information-circle" size={24} color="#6B7280" />
            <Text style={styles.cancelledText}>
              Підписку скасовано. Зв'яжіться з адміністрацією для поновлення.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  headerSpacer: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F0F10',
  },
  actionsCard: {
    marginBottom: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  actionButtonDanger: {
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#0F0F10',
  },
  cancelledCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelledText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
  },
});
