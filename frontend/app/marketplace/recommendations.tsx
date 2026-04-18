import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

export default function RecommendationsScreen() {
  const router = useRouter();

  const { data: recs, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['marketplace-recommendations'],
    queryFn: () => api.get('/shop/marketplace/recommendations'),
  });

  if (isLoading) return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  const recsList = recs || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Рекомендації тренера</Text>
        <View style={{ width: 44 }} />
      </View>

      {recsList.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={64} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Рекомендацій поки немає</Text>
          <Text style={styles.emptySubtitle}>Тренер ще не рекомендував вам товари</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {recsList.map((rec: any, idx: number) => {
            const prod = rec.product;
            return (
              <TouchableOpacity
                key={rec.id || idx}
                testID={`recommendation-${idx}`}
                style={styles.recCard}
                onPress={() => prod && router.push(`/marketplace/product/${prod._id || rec.productId}`)}
              >
                <View style={styles.recBadge}>
                  <Ionicons name="star" size={16} color="#7C3AED" />
                </View>
                <View style={styles.recIcon}>
                  <Ionicons name="cube-outline" size={32} color={colors.textTertiary} />
                </View>
                <View style={styles.recContent}>
                  <Text style={styles.recCoach}>{rec.coachName || 'Тренер'}</Text>
                  <Text style={styles.recProductName} numberOfLines={2}>{rec.productName || prod?.name || 'Товар'}</Text>
                  {rec.reason && <Text style={styles.recReason} numberOfLines={2}>{rec.reason}</Text>}
                  {rec.studentName && <Text style={styles.recStudent}>Для: {rec.studentName}</Text>}
                  {prod && <Text style={styles.recPrice}>{prod.price} ₴</Text>}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  recCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2, position: 'relative' },
  recBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: '#EDE9FE', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  recIcon: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginLeft: 24 },
  recContent: { flex: 1, marginLeft: 12 },
  recCoach: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  recProductName: { fontSize: 15, fontWeight: '700', color: '#0F0F10', marginTop: 2, lineHeight: 20 },
  recReason: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  recStudent: { fontSize: 12, color: '#3B82F6', fontWeight: '500', marginTop: 4 },
  recPrice: { fontSize: 16, fontWeight: '800', color: '#E30613', marginTop: 4 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#0F0F10', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
});
