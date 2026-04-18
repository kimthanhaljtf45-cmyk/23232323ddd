import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  oldPrice?: number;
  category: string;
  sportType: string;
  usageType: string;
  sizes: string[];
  colors: string[];
  images: string[];
  stock: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  rating: number;
  reviewsCount: number;
  brand?: string;
}

const CATS = [
  { id: 'ALL', label: 'Усе' },
  { id: 'UNIFORM', label: 'Форма' },
  { id: 'PROTECTION', label: 'Захист' },
  { id: 'EQUIPMENT', label: 'Екіпіровка' },
  { id: 'ACCESSORIES', label: 'Аксесуари' },
  { id: 'SPORT_NUTRITION', label: 'Спортпіт' },
];

const CAT_ICONS: Record<string, string> = {
  UNIFORM: 'shirt', PROTECTION: 'shield-checkmark', EQUIPMENT: 'barbell',
  ACCESSORIES: 'bag-handle', SPORT_NUTRITION: 'flask', NUTRITION: 'nutrition',
};
const CAT_COLORS: Record<string, string> = {
  UNIFORM: '#3B82F6', PROTECTION: '#E30613', EQUIPMENT: '#D97706',
  ACCESSORIES: '#7C3AED', SPORT_NUTRITION: '#16A34A', NUTRITION: '#059669',
};
const SPORT_LABELS: Record<string, string> = {
  KARATE: 'Карате', TAEKWONDO: 'Тхеквондо', BOXING: 'Бокс', MMA: 'ММА', JUDO: 'Дзюдо', UNIVERSAL: 'Універсальне',
};

export default function ShopScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const user = useStore((s) => s.user);
  const setCartItemsCount = useStore((s) => s.setCartItemsCount);

  const [cat, setCat] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('popular');

  const { data: products, isLoading, refetch } = useQuery<Product[]>({
    queryKey: ['shop-products', cat, search, sort],
    queryFn: async () => {
      let url = '/shop/products?';
      if (cat !== 'ALL') url += `category=${cat}&`;
      if (search) url += `search=${encodeURIComponent(search)}&`;
      url += `sort=${sort}`;
      return api.get(url);
    },
  });

  const { data: recommendations } = useQuery<Product[]>({
    queryKey: ['shop-recommendations'],
    queryFn: () => api.get('/shop/products?sort=popular&limit=4'),
  });

  const filtered = useMemo(() => products || [], [products]);

  const renderProduct = ({ item: p }: { item: Product }) => {
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const iconName = CAT_ICONS[p.category] || 'cube';
    const iconColor = CAT_COLORS[p.category] || '#6B7280';
    const sportLabel = SPORT_LABELS[p.sportType] || '';

    return (
      <TouchableOpacity testID={`product-${p._id}`} style={s.card} activeOpacity={0.7}
        onPress={() => router.push(`/marketplace/product/${p._id}`)}>
        {/* Image area */}
        <View style={[s.cardImg, { backgroundColor: iconColor + '10' }]}>
          <Ionicons name={iconName as any} size={36} color={iconColor} />
          {discount > 0 && (
            <View style={s.discBadge}><Text style={s.discBadgeT}>-{discount}%</Text></View>
          )}
          {p.isNewArrival && (
            <View style={s.newBadge}><Text style={s.newBadgeT}>NEW</Text></View>
          )}
        </View>
        {/* Info */}
        <View style={s.cardInfo}>
          <Text style={s.cardBrand}>{p.brand || 'АТАКА'}</Text>
          <Text style={s.cardName} numberOfLines={2}>{p.name}</Text>
          {sportLabel ? <Text style={s.cardSport}>{sportLabel}</Text> : null}
          <View style={s.cardBottom}>
            <View>
              <Text style={s.cardPrice}>{p.price} ₴</Text>
              {p.oldPrice ? <Text style={s.cardOldPrice}>{p.oldPrice} ₴</Text> : null}
            </View>
            <View style={s.ratingWrap}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={s.ratingT}>{p.rating?.toFixed(1)}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Магазин</Text>
        <TouchableOpacity testID="cart-btn" style={s.cartBtn} onPress={() => router.push('/marketplace/cart')}>
          <Ionicons name="cart-outline" size={22} color="#0F172A" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={s.searchInput} placeholder="Пошук товарів..." value={search}
          onChangeText={setSearch} placeholderTextColor="#9CA3AF" returnKeyType="search" />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Categories — compact pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.catsRow} contentContainerStyle={s.catsContent}>
        {CATS.map(c => (
          <TouchableOpacity key={c.id} testID={`cat-${c.id}`}
            style={[s.catPill, cat === c.id && s.catPillActive]}
            onPress={() => setCat(c.id)}>
            <Text style={[s.catPillT, cat === c.id && s.catPillTActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sort */}
      <View style={s.sortRow}>
        <Text style={s.resultCount}>{filtered.length} товарів</Text>
        <View style={s.sortPills}>
          {[
            { k: 'popular', l: 'Популярне' },
            { k: 'price_asc', l: 'Дешевше' },
            { k: 'price_desc', l: 'Дорожче' },
          ].map(o => (
            <TouchableOpacity key={o.k} testID={`sort-${o.k}`}
              style={[s.sortPill, sort === o.k && s.sortPillActive]}
              onPress={() => setSort(o.k)}>
              <Text style={[s.sortPillT, sort === o.k && s.sortPillTActive]}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Personalized recommendations */}
      {recommendations && recommendations.length > 0 && cat === 'ALL' && !search && (
        <View style={s.recoWrap}>
          <Text style={s.recoTitle}>Рекомендовано для вашої дитини</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {recommendations.slice(0, 4).map((p: Product) => (
              <TouchableOpacity key={p._id} testID={`reco-${p._id}`} style={s.recoCard}
                onPress={() => router.push(`/marketplace/product/${p._id}`)}>
                <View style={[s.recoImg, { backgroundColor: (CAT_COLORS[p.category] || '#6B7280') + '15' }]}>
                  <Ionicons name={(CAT_ICONS[p.category] || 'cube') as any} size={22} color={CAT_COLORS[p.category] || '#6B7280'} />
                </View>
                <Text style={s.recoName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.recoPrice}>{p.price} ₴</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Products grid */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="search-outline" size={48} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Нічого не знайдено</Text>
          <Text style={s.emptyDesc}>Спробуйте змінити фільтри або пошук</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderProduct}
          keyExtractor={(p) => p._id}
          numColumns={2}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={s.gridContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => refetch()} tintColor="#E30613" />}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F8F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  cartBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  // Search
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A', padding: 0 },
  // Categories — compact
  catsRow: { maxHeight: 44, marginTop: 12 },
  catsContent: { paddingHorizontal: 20, gap: 6, flexDirection: 'row', alignItems: 'center' },
  catPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  catPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  catPillT: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catPillTActive: { color: '#fff' },
  // Sort
  sortRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 12, marginBottom: 4 },
  resultCount: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  sortPills: { flexDirection: 'row', gap: 4 },
  sortPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sortPillActive: { backgroundColor: '#E5E7EB' },
  sortPillT: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  sortPillTActive: { color: '#0F172A' },
  // Reco
  recoWrap: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#FFFBEB', marginBottom: 4 },
  recoTitle: { fontSize: 13, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  recoCard: { width: 120, backgroundColor: '#fff', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#FDE68A' },
  recoImg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  recoName: { fontSize: 11, fontWeight: '600', color: '#0F172A' },
  recoPrice: { fontSize: 13, fontWeight: '800', color: '#E30613', marginTop: 2 },
  // Grid
  gridContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 },
  gridRow: { gap: 10, marginBottom: 10 },
  // Card
  card: { flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  cardImg: { height: 120, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  discBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#E30613', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discBadgeT: { color: '#fff', fontSize: 10, fontWeight: '700' },
  newBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: '#16A34A', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newBadgeT: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardInfo: { padding: 10 },
  cardBrand: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardName: { fontSize: 13, fontWeight: '600', color: '#0F172A', marginTop: 2, lineHeight: 17 },
  cardSport: { fontSize: 10, color: '#6B7280', marginTop: 2 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 },
  cardPrice: { fontSize: 16, fontWeight: '800', color: '#E30613' },
  cardOldPrice: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
  ratingWrap: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingT: { fontSize: 11, fontWeight: '600', color: '#374151' },
  // Empty
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginTop: 12 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },
});
