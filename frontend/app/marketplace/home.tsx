import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/lib/api';
import { colors } from '../../src/theme';

const ProductCard = ({ product, onPress }: { product: any; onPress: () => void }) => {
  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  return (
    <TouchableOpacity testID={`product-${product._id}`} style={s.productCard} onPress={onPress}>
      <View style={s.productImage}>
        <Ionicons name="cube-outline" size={32} color={colors.textTertiary} />
        {discount > 0 && (
          <View style={s.discBadge}><Text style={s.discText}>-{discount}%</Text></View>
        )}
        {product.isRecommended && (
          <View style={s.recBadge}><Ionicons name="star" size={10} color="#fff" /></View>
        )}
      </View>
      <Text style={s.productName} numberOfLines={2}>{product.name}</Text>
      <View style={s.priceRow}>
        <Text style={s.productPrice}>{product.price} ₴</Text>
        {product.oldPrice && <Text style={s.oldPrice}>{product.oldPrice} ₴</Text>}
      </View>
      {product.stock === 0 && <Text style={s.outOfStock}>Немає в наявності</Text>}
    </TouchableOpacity>
  );
};

const SectionHeader = ({ title, icon, onSeeAll }: { title: string; icon: string; onSeeAll?: () => void }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionLeft}>
      <Ionicons name={icon as any} size={20} color={colors.primary} />
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
    {onSeeAll && (
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={s.seeAll}>Всі</Text>
      </TouchableOpacity>
    )}
  </View>
);

export default function MarketplaceHomeScreen() {
  const router = useRouter();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['marketplace-home'],
    queryFn: () => api.get('/shop/marketplace/home'),
  });

  const goProduct = (id: string) => router.push(`/marketplace/product/${id}`);

  if (isLoading) return (
    <SafeAreaView style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
    </SafeAreaView>
  );

  const { recommendations = [], campaigns = [], campaignProducts = [], categories = [], featured = [], popular = [], newArrivals = [] } = data || {};

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F0F10" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Маркетплейс</Text>
        <View style={s.headerRight}>
          <TouchableOpacity testID="cart-btn" onPress={() => router.push('/marketplace/cart')} style={s.headerBtn}>
            <Ionicons name="cart-outline" size={24} color="#0F0F10" />
          </TouchableOpacity>
          <TouchableOpacity testID="orders-btn" onPress={() => router.push('/marketplace/orders')} style={s.headerBtn}>
            <Ionicons name="receipt-outline" size={22} color="#0F0F10" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
      >
        {/* Coach Recommendations */}
        {recommendations.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Рекомендовано тренером" icon="star" onSeeAll={() => router.push('/marketplace/recommendations')} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {recommendations.map((rec: any, idx: number) => (
                <TouchableOpacity key={idx} testID={`rec-${idx}`} style={s.recCard} onPress={() => goProduct(rec.productId || rec.product?._id)}>
                  <View style={s.recCardIcon}>
                    <Ionicons name="star" size={16} color="#7C3AED" />
                  </View>
                  <Text style={s.recCardName} numberOfLines={2}>{rec.productName || rec.product?.name}</Text>
                  <Text style={s.recCardCoach}>{rec.coachName}</Text>
                  {rec.product && <Text style={s.recCardPrice}>{rec.product.price} ₴</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Campaigns */}
        {campaigns.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Акції" icon="pricetag" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {campaigns.map((c: any, idx: number) => (
                <View key={idx} style={s.campaignCard}>
                  <View style={s.campaignBadge}>
                    <Ionicons name="flame" size={16} color="#fff" />
                  </View>
                  <Text style={s.campaignDiscount}>-{c.discountPercent}%</Text>
                  <Text style={s.campaignName} numberOfLines={2}>{c.name}</Text>
                  <Text style={s.campaignDesc}>{c.productCount} товар(ів)</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Categories */}
        {categories.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Категорії" icon="grid" />
            <View style={s.catGrid}>
              {categories.map((cat: any) => (
                <TouchableOpacity key={cat.id} testID={`cat-${cat.id}`} style={s.catCard}>
                  <Ionicons name={cat.icon as any || 'cube'} size={24} color={colors.primary} />
                  <Text style={s.catName}>{cat.name}</Text>
                  <Text style={s.catCount}>{cat.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Featured */}
        {featured.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Рекомендоване" icon="trophy" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {featured.map((p: any) => (
                <ProductCard key={p._id} product={p} onPress={() => goProduct(p._id)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Popular */}
        {popular.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Популярне" icon="trending-up" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {popular.map((p: any) => (
                <ProductCard key={p._id} product={p} onPress={() => goProduct(p._id)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* New Arrivals */}
        {newArrivals.length > 0 && (
          <View style={s.section}>
            <SectionHeader title="Новинки" icon="sparkles" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hScroll}>
              {newArrivals.map((p: any) => (
                <ProductCard key={p._id} product={p} onPress={() => goProduct(p._id)} />
              ))}
            </ScrollView>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff' },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F0F10' },
  headerRight: { flexDirection: 'row', gap: 8 },
  scroll: { flex: 1 },
  section: { marginTop: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0F0F10' },
  seeAll: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  hScroll: { paddingHorizontal: 16, gap: 12 },
  // Recommendation Cards
  recCard: { width: 140, backgroundColor: '#F5F3FF', borderRadius: 14, padding: 14 },
  recCardIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EDE9FE', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  recCardName: { fontSize: 13, fontWeight: '600', color: '#0F0F10', lineHeight: 18 },
  recCardCoach: { fontSize: 11, color: '#7C3AED', marginTop: 4 },
  recCardPrice: { fontSize: 15, fontWeight: '800', color: '#E30613', marginTop: 6 },
  // Campaign Cards
  campaignCard: { width: 160, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 16, position: 'relative' },
  campaignBadge: { position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: '#E30613', justifyContent: 'center', alignItems: 'center' },
  campaignDiscount: { fontSize: 28, fontWeight: '900', color: '#E30613' },
  campaignName: { fontSize: 13, fontWeight: '600', color: '#0F0F10', marginTop: 4, lineHeight: 18 },
  campaignDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  // Category Grid
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  catCard: { width: '30%', backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  catName: { fontSize: 12, fontWeight: '600', color: '#0F0F10', marginTop: 6, textAlign: 'center' },
  catCount: { fontSize: 11, color: colors.textTertiary, marginTop: 2 },
  // Product Cards
  productCard: { width: 150, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.04, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2 },
  productImage: { height: 100, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  discBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#E30613', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  recBadge: { position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: 10, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' },
  productName: { fontSize: 13, fontWeight: '600', color: '#0F0F10', paddingHorizontal: 10, paddingTop: 8, lineHeight: 18 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingBottom: 10, paddingTop: 4 },
  productPrice: { fontSize: 15, fontWeight: '800', color: '#E30613' },
  oldPrice: { fontSize: 12, color: colors.textTertiary, textDecorationLine: 'line-through' },
  outOfStock: { fontSize: 11, color: '#EF4444', paddingHorizontal: 10, paddingBottom: 8 },
});
