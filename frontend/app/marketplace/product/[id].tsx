import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../src/lib/api';

const CAT_LABELS: Record<string, string> = { EQUIPMENT: 'Екіпіровка', UNIFORM: 'Форма', PROTECTION: 'Захист', ACCESSORIES: 'Аксесуари', SPORT_NUTRITION: 'Спортпіт' };
const CAT_ICONS: Record<string, string> = { UNIFORM: 'shirt', PROTECTION: 'shield-checkmark', EQUIPMENT: 'barbell', ACCESSORIES: 'bag-handle', SPORT_NUTRITION: 'flask' };
const CAT_COLORS: Record<string, string> = { UNIFORM: '#3B82F6', PROTECTION: '#E30613', EQUIPMENT: '#D97706', ACCESSORIES: '#7C3AED', SPORT_NUTRITION: '#16A34A' };
const SPORT_LABELS: Record<string, string> = { KARATE: 'Карате', TAEKWONDO: 'Тхеквондо', BOXING: 'Бокс', MMA: 'ММА', JUDO: 'Дзюдо', UNIVERSAL: 'Універсальне' };
const USAGE_LABELS: Record<string, string> = { TRAINING: 'Тренування', COMPETITION: 'Змагання', BOTH: 'Тренування + Змагання' };

// Structured specs per category
function getSpecsForProduct(product: any): { label: string; value: string }[] {
  const specs: { label: string; value: string }[] = [];
  if (product.sportType) specs.push({ label: 'Вид спорту', value: SPORT_LABELS[product.sportType] || product.sportType });
  if (product.usageType) specs.push({ label: 'Призначення', value: USAGE_LABELS[product.usageType] || product.usageType });
  if (product.brand) specs.push({ label: 'Бренд', value: product.brand });
  if (product.sku) specs.push({ label: 'Артикул', value: product.sku });

  const cat = product.category;
  if (cat === 'PROTECTION') {
    specs.push({ label: 'Тип', value: product.name?.includes('Шолом') ? 'Шолом' : product.name?.includes('Рукавич') ? 'Рукавички' : product.name?.includes('Щитки') ? 'Щитки' : 'Захисне спорядження' });
    specs.push({ label: 'Матеріал', value: 'PU шкіра / поліуретан' });
    specs.push({ label: 'Підкладка', value: 'EVA піна, ергономічна' });
    specs.push({ label: 'Сертифікація', value: product.sportType === 'KARATE' ? 'WKF approved' : product.sportType === 'TAEKWONDO' ? 'WT approved' : 'Стандарт' });
  } else if (cat === 'UNIFORM') {
    specs.push({ label: 'Тип', value: product.name?.includes('Кімоно') ? 'Кімоно (Gi)' : product.name?.includes('Добок') ? 'Добок' : 'Форма' });
    specs.push({ label: 'Матеріал', value: '100% бавовна' });
    specs.push({ label: 'Щільність', value: product.description?.match(/\d+г\/м²/)?.[0] || '240 г/м²' });
    specs.push({ label: 'Колір', value: product.colors?.[0] || 'Білий' });
  } else if (cat === 'EQUIPMENT') {
    specs.push({ label: 'Тип', value: 'Тренувальне обладнання' });
    specs.push({ label: 'Матеріал', value: 'Високоякісний синтетичний матеріал' });
  } else if (cat === 'SPORT_NUTRITION' || cat === 'NUTRITION') {
    specs.push({ label: 'Тип', value: 'Спортивне харчування' });
    specs.push({ label: 'Форма', value: 'Порошок / капсули' });
  }

  if (product.sizeChart) {
    if (product.sizeChart.ageMin && product.sizeChart.ageMax) specs.push({ label: 'Вік', value: `${product.sizeChart.ageMin}–${product.sizeChart.ageMax} років` });
    if (product.sizeChart.heightMin && product.sizeChart.heightMax) specs.push({ label: 'Зріст', value: `${product.sizeChart.heightMin}–${product.sizeChart.heightMax} см` });
  }
  if (product.stock !== undefined) specs.push({ label: 'Залишок', value: `${product.stock} шт` });
  return specs;
}

// Display human-friendly sizes
function displaySize(s: string): string {
  const num = parseInt(s);
  if (!isNaN(num) && num >= 100) {
    // Height-based sizes — show as "120 см"
    return `${num} см`;
  }
  return s; // Already XS, S, M, L, etc.
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [showAllSpecs, setShowAllSpecs] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/shop/products/${id}`),
    enabled: !!id,
  });

  const addToCartMutation = useMutation({
    mutationFn: (data: any) => api.post('/shop/cart/add', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      Alert.alert('Додано в кошик', `${product?.name} додано`, [
        { text: 'Продовжити', style: 'cancel' },
        { text: 'Кошик', onPress: () => router.push('/marketplace/cart') },
      ]);
    },
    onError: (e: any) => Alert.alert('Помилка', e.response?.data?.message || 'Не вдалося додати'),
  });

  const handleAddToCart = () => {
    if (!product) return;
    if (product.sizes?.length > 0 && !selectedSize) {
      Alert.alert('Оберіть розмір', 'Будь ласка, оберіть розмір');
      return;
    }
    addToCartMutation.mutate({ productId: id, quantity, size: selectedSize });
  };

  if (isLoading) return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>
    </SafeAreaView>
  );

  if (!product) return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.center}>
        <Text style={s.emptyT}>Товар не знайдено</Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><Text style={s.backBtnT}>Назад</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  const discount = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0;
  const inStock = product.stock > 0;
  const specs = getSpecsForProduct(product);
  const iconName = CAT_ICONS[product.category] || 'cube';
  const iconColor = CAT_COLORS[product.category] || '#6B7280';

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity testID="back-button" onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <TouchableOpacity testID="cart-button" onPress={() => router.push('/marketplace/cart')} style={s.headerBtn}>
          <Ionicons name="cart-outline" size={24} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Product Image */}
        <View style={[s.imgArea, { backgroundColor: iconColor + '10' }]}>
          <Ionicons name={iconName as any} size={72} color={iconColor} />
          {discount > 0 && (
            <View style={s.discBadge}><Text style={s.discBadgeT}>-{discount}%</Text></View>
          )}
          {product.isRecommended && (
            <View style={s.recBadge}><Ionicons name="star" size={12} color="#fff" /><Text style={s.recBadgeT}>Тренер рекомендує</Text></View>
          )}
        </View>

        <View style={s.content}>
          {/* Category + Sport tag */}
          <View style={s.tags}>
            <View style={[s.tag, { backgroundColor: iconColor + '15' }]}>
              <Text style={[s.tagT, { color: iconColor }]}>{CAT_LABELS[product.category] || product.category}</Text>
            </View>
            {product.sportType && (
              <View style={s.tag}><Text style={s.tagT}>{SPORT_LABELS[product.sportType] || product.sportType}</Text></View>
            )}
            {product.usageType && product.usageType !== 'BOTH' && (
              <View style={s.tag}><Text style={s.tagT}>{USAGE_LABELS[product.usageType] || product.usageType}</Text></View>
            )}
          </View>

          {/* Name + Brand */}
          <Text style={s.name}>{product.name}</Text>
          {product.brand && <Text style={s.brand}>{product.brand}</Text>}

          {/* Rating */}
          <View style={s.ratingRow}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={s.ratingVal}>{product.rating?.toFixed(1)}</Text>
            <Text style={s.ratingCount}>({product.reviewsCount} відгуків)</Text>
          </View>

          {/* Price */}
          <View style={s.priceRow}>
            <Text style={s.price}>{product.price} ₴</Text>
            {product.oldPrice && <Text style={s.oldPrice}>{product.oldPrice} ₴</Text>}
            {discount > 0 && <View style={s.saveBadge}><Text style={s.saveBadgeT}>Економія {product.oldPrice! - product.price} ₴</Text></View>}
          </View>

          {/* Stock */}
          <View style={[s.stockRow, !inStock && { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name={inStock ? 'checkmark-circle' : 'close-circle'} size={16} color={inStock ? '#16A34A' : '#DC2626'} />
            <Text style={[s.stockT, !inStock && { color: '#DC2626' }]}>
              {inStock ? `В наявності (${product.stock} шт)` : 'Немає в наявності'}
            </Text>
          </View>

          {/* Description */}
          {product.description && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Опис</Text>
              <Text style={s.descT}>{product.description}</Text>
            </View>
          )}

          {/* Structured Specs */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Характеристики</Text>
            <View style={s.specsCard}>
              {(showAllSpecs ? specs : specs.slice(0, 5)).map((sp, i) => (
                <View key={i} style={[s.specRow, i > 0 && { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
                  <Text style={s.specLbl}>{sp.label}</Text>
                  <Text style={s.specVal}>{sp.value}</Text>
                </View>
              ))}
              {specs.length > 5 && (
                <TouchableOpacity testID="show-all-specs" style={s.showMore} onPress={() => setShowAllSpecs(!showAllSpecs)}>
                  <Text style={s.showMoreT}>{showAllSpecs ? 'Згорнути' : `Показати все (${specs.length})`}</Text>
                  <Ionicons name={showAllSpecs ? 'chevron-up' : 'chevron-down'} size={16} color="#E30613" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Sizes */}
          {product.sizes?.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>Розмір</Text>
              <View style={s.sizesWrap}>
                {product.sizes.map((sz: string) => (
                  <TouchableOpacity key={sz} testID={`size-${sz}`}
                    style={[s.sizeBtn, selectedSize === sz && s.sizeBtnActive]}
                    onPress={() => setSelectedSize(sz)}>
                    <Text style={[s.sizeBtnT, selectedSize === sz && s.sizeBtnTActive]}>{displaySize(sz)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* Size guide hint */}
              <Text style={s.sizeHint}>
                {product.sizeChart?.ageMin ? `Для віку ${product.sizeChart.ageMin}–${product.sizeChart.ageMax} р.` : ''}
                {product.sizeChart?.heightMin ? ` / Зріст ${product.sizeChart.heightMin}–${product.sizeChart.heightMax} см` : ''}
              </Text>
            </View>
          )}

          {/* Quantity */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Кількість</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity testID="qty-minus" style={s.qtyBtn} onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                <Ionicons name="remove" size={20} color="#0F172A" />
              </TouchableOpacity>
              <Text style={s.qtyVal}>{quantity}</Text>
              <TouchableOpacity testID="qty-plus" style={s.qtyBtn} onPress={() => setQuantity(Math.min(product.stock, quantity + 1))}>
                <Ionicons name="add" size={20} color="#0F172A" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Coach Recommendation */}
          {product.recommendedByCoachName && (
            <View style={s.coachRec}>
              <Ionicons name="person-circle" size={24} color="#7C3AED" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.coachRecTitle}>Рекомендовано тренером</Text>
                <Text style={s.coachRecName}>{product.recommendedByCoachName}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <View>
          <Text style={s.bottomLbl}>Всього</Text>
          <Text style={s.bottomPrice}>{product.price * quantity} ₴</Text>
        </View>
        <TouchableOpacity testID="add-to-cart-button"
          style={[s.addBtn, (!inStock || addToCartMutation.isPending) && s.addBtnOff]}
          onPress={handleAddToCart} disabled={!inStock || addToCartMutation.isPending}>
          {addToCartMutation.isPending ? <ActivityIndicator color="#fff" /> : (
            <><Ionicons name="cart" size={20} color="#fff" /><Text style={s.addBtnT}>В кошик</Text></>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyT: { fontSize: 16, color: '#6B7280' },
  backBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#E30613', borderRadius: 10 },
  backBtnT: { color: '#fff', fontWeight: '600' },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  // Image
  imgArea: { height: 260, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  discBadge: { position: 'absolute', top: 16, left: 16, backgroundColor: '#E30613', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  discBadgeT: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recBadge: { position: 'absolute', top: 16, right: 16, backgroundColor: '#7C3AED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 },
  recBadgeT: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // Content
  content: { padding: 20 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 10 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F3F4F6' },
  tagT: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  name: { fontSize: 22, fontWeight: '800', color: '#0F172A', lineHeight: 28 },
  brand: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  ratingVal: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  ratingCount: { fontSize: 13, color: '#9CA3AF' },
  // Price
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  price: { fontSize: 28, fontWeight: '800', color: '#E30613' },
  oldPrice: { fontSize: 18, color: '#9CA3AF', textDecorationLine: 'line-through' },
  saveBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  saveBadgeT: { fontSize: 11, fontWeight: '700', color: '#16A34A' },
  // Stock
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, alignSelf: 'flex-start' },
  stockT: { fontSize: 13, color: '#16A34A', fontWeight: '500' },
  // Section
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 10 },
  descT: { fontSize: 15, color: '#4B5563', lineHeight: 22 },
  // Specs
  specsCard: { backgroundColor: '#F9FAFB', borderRadius: 14, overflow: 'hidden' },
  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  specLbl: { fontSize: 13, color: '#6B7280' },
  specVal: { fontSize: 13, fontWeight: '600', color: '#0F172A', textAlign: 'right', maxWidth: '60%' },
  showMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  showMoreT: { fontSize: 13, fontWeight: '600', color: '#E30613' },
  // Sizes
  sizesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sizeBtn: { minWidth: 50, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 2, borderColor: 'transparent', alignItems: 'center' },
  sizeBtnActive: { borderColor: '#E30613', backgroundColor: '#FEF2F2' },
  sizeBtnT: { fontSize: 14, fontWeight: '600', color: '#374151' },
  sizeBtnTActive: { color: '#E30613' },
  sizeHint: { fontSize: 12, color: '#9CA3AF', marginTop: 8 },
  // Quantity
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  qtyVal: { fontSize: 20, fontWeight: '700', color: '#0F172A', minWidth: 30, textAlign: 'center' },
  // Coach
  coachRec: { flexDirection: 'row', alignItems: 'center', marginTop: 20, backgroundColor: '#F5F3FF', padding: 14, borderRadius: 12 },
  coachRecTitle: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  coachRecName: { fontSize: 14, color: '#4B5563', marginTop: 2 },
  // Bottom
  bottomBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#fff' },
  bottomLbl: { fontSize: 12, color: '#9CA3AF' },
  bottomPrice: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#E30613', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  addBtnOff: { backgroundColor: '#FECACA' },
  addBtnT: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
