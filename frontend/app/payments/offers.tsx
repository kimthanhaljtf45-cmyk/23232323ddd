import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../src/lib/api';

type Offer = {
  id: string;
  studentId: string;
  type: string;
  discountPercent: number;
  title: string;
  message?: string;
  expiresAt: string;
  status: string;
  accepted: boolean;
};

export default function ParentOffersScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: offers = [], isLoading, refetch } = useQuery<Offer[]>({
    queryKey: ['parent-offers'],
    queryFn: () => api.get('/parent/offers'),
  });

  const { data: availableDiscounts = [] } = useQuery<any[]>({
    queryKey: ['available-discounts'],
    queryFn: async () => {
      try { return await api.get('/discounts/available'); } catch { return []; }
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (offerId: string) => api.post(`/parent/offers/${offerId}/accept`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['parent-offers'] });
      Alert.alert('Знижку застосовано!', data.message || 'Знижка застосована до вашого рахунку');
    },
    onError: () => {
      Alert.alert('Помилка', 'Не вдалося застосувати знижку');
    },
  });

  const handleAccept = (offer: Offer) => {
    Alert.alert(
      'Застосувати знижку?',
      `${offer.title}\n-${offer.discountPercent}%\n\n${offer.message || ''}`,
      [
        { text: 'Скасувати', style: 'cancel' },
        { text: 'Застосувати', style: 'default', onPress: () => acceptMutation.mutate(offer.id) },
      ],
    );
  };

  const getTimeRemaining = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Прострочено';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) return `${Math.floor(hours / 24)} днів`;
    if (hours > 0) return `${hours}г ${mins}хв`;
    return `${mins} хвилин`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color="#FAFAFA" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Знижки та пропозиції</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#DC2626" />}
      >
        {/* Personal Offers */}
        {offers.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={20} color="#DC2626" />
              <Text style={styles.sectionTitle}>Персональні пропозиції</Text>
            </View>
            {offers.map(offer => (
              <View key={offer.id} testID={`offer-card-${offer.id}`} style={styles.offerCard}>
                <View style={styles.personalBadge}>
                  <Ionicons name="flame" size={12} color="#DC2626" />
                  <Text style={styles.personalBadgeText}>Спеціальна пропозиція</Text>
                </View>

                <View style={styles.discountCircle}>
                  <Text style={styles.discountValue}>-{offer.discountPercent}%</Text>
                </View>

                <Text style={styles.offerName}>{offer.title}</Text>
                {offer.message ? <Text style={styles.offerDescription}>{offer.message}</Text> : null}

                <View style={styles.timerRow}>
                  <Ionicons name="time-outline" size={14} color="#F59E0B" />
                  <Text style={styles.timerText}>Залишилось: {getTimeRemaining(offer.expiresAt)}</Text>
                </View>

                <TouchableOpacity
                  testID={`accept-offer-${offer.id}`}
                  style={styles.applyBtn}
                  onPress={() => handleAccept(offer)}
                  disabled={acceptMutation.isPending}
                >
                  {acceptMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.applyBtnText}>ЗАСТОСУВАТИ</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Available Discounts */}
        <View style={[styles.sectionHeader, { marginTop: offers.length > 0 ? 24 : 16 }]}>
          <Ionicons name="pricetag" size={20} color="#3B82F6" />
          <Text style={styles.sectionTitle}>Доступні знижки</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#DC2626" style={{ marginTop: 40 }} />
        ) : availableDiscounts.length === 0 && offers.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="gift-outline" size={56} color="#3F3F46" />
            <Text style={styles.emptyTitle}>Поки немає пропозицій</Text>
            <Text style={styles.emptySubtext}>
              Система автоматично підбирає знижки для вас.{'\n'}Перевіряйте цей розділ регулярно!
            </Text>
          </View>
        ) : (
          availableDiscounts.map((d, i) => (
            <View key={i} style={styles.availableCard}>
              <View style={styles.availableIcon}>
                <Ionicons
                  name={d.type === 'FAMILY' ? 'people' : d.type === 'LOYALTY' ? 'heart' : d.type === 'REFERRAL' ? 'share-social' : 'pricetag'}
                  size={20} color="#DC2626"
                />
              </View>
              <View style={styles.availableInfo}>
                <Text style={styles.availableName}>{d.name}</Text>
                <Text style={styles.availableDescription}>{d.description || ''}</Text>
              </View>
              <View style={styles.availableValue}>
                <Text style={styles.availableValueText}>
                  {d.valueType === 'PERCENT' ? `-${d.value}%` : `-${d.value}₴`}
                </Text>
              </View>
            </View>
          ))
        )}

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>Як працюють знижки?</Text>
          {[
            'Система аналізує вашу активність та лояльність',
            'Автоматично підбирає найкращі пропозиції',
            'Натисніть "Застосувати" — знижка оновить рахунок',
          ].map((text, i) => (
            <View key={i} style={styles.howItem}>
              <View style={styles.howNumber}><Text style={styles.howNumberText}>{i + 1}</Text></View>
              <Text style={styles.howText}>{text}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090B' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FAFAFA' },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FAFAFA', textTransform: 'uppercase', letterSpacing: 0.5 },
  offerCard: { backgroundColor: '#18181B', borderRadius: 16, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#DC262640' },
  personalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  personalBadgeText: { fontSize: 11, color: '#DC2626', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  discountCircle: { backgroundColor: '#DC262620', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16, borderWidth: 2, borderColor: '#DC2626' },
  discountValue: { fontSize: 22, fontWeight: '900', color: '#DC2626' },
  offerName: { fontSize: 18, fontWeight: '700', color: '#FAFAFA', textAlign: 'center', marginBottom: 4 },
  offerDescription: { fontSize: 14, color: '#A1A1AA', textAlign: 'center', marginBottom: 12 },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 16 },
  timerText: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
  applyBtn: { backgroundColor: '#DC2626', borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  applyBtnText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 1 },
  availableCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181B', borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#27272A' },
  availableIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DC262615', alignItems: 'center', justifyContent: 'center' },
  availableInfo: { flex: 1, marginLeft: 12 },
  availableName: { fontSize: 14, fontWeight: '600', color: '#FAFAFA' },
  availableDescription: { fontSize: 12, color: '#71717A', marginTop: 2 },
  availableValue: { backgroundColor: '#16A34A20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  availableValueText: { fontSize: 16, fontWeight: '800', color: '#16A34A' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#52525B', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#71717A', textAlign: 'center', marginTop: 8, maxWidth: 280 },
  howItWorks: { backgroundColor: '#18181B', borderRadius: 16, padding: 20, marginTop: 24, borderWidth: 1, borderColor: '#27272A' },
  howTitle: { fontSize: 15, fontWeight: '700', color: '#FAFAFA', marginBottom: 16 },
  howItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  howNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#DC262620', alignItems: 'center', justifyContent: 'center' },
  howNumberText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  howText: { flex: 1, fontSize: 13, color: '#A1A1AA', lineHeight: 18 },
});
