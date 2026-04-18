import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';

/**
 * JUNIOR X10 Sprint 3 — МАРКЕТ (контекстна монетизація)
 * Персональні секції зверху → звичайний каталог знизу
 *   ⭐ Тренер рекомендує
 *   🥋 Під твій пояс (стартовий комплект)
 *   🏆 Перед змаганнями
 */

const CATEGORIES = [
  { key: 'all', label: 'Все' },
  { key: 'UNIFORM', label: 'Форма' },
  { key: 'EQUIPMENT', label: 'Спорядження' },
  { key: 'PROTECTION', label: 'Захист' },
  { key: 'ACCESSORIES', label: 'Аксесуари' },
];

const BELT_STARTER_HINT: Record<string, string> = {
  WHITE: 'Білий пояс: стартовий комплект новачка',
  YELLOW: 'Жовтий пояс: час оновити форму',
  ORANGE: 'Помаранчевий пояс: додати захист',
  GREEN: 'Зелений пояс: повний комплект спорядження',
  BLUE: 'Синій пояс: професійна екіпіровка',
  PURPLE: 'Фіолетовий пояс: турнірний рівень',
  BROWN: 'Коричневий пояс: готуємось до чорного',
  BLACK: 'Чорний пояс: персональний підхід',
};

function SectionHeader({ icon, iconColor, title, subtitle }: any) {
  return (
    <View style={s.sectionHeader}>
      <View style={[s.sectionIcon, { backgroundColor: `${iconColor}1A` }]}>
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>{title}</Text>
        {subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function ProductTile({ item, xp, onBuy, testID }: any) {
  const discount = xp >= 50 ? Math.round((item.price || 0) * 0.05) : 0;
  return (
    <TouchableOpacity testID={testID} style={s.tile} onPress={() => onBuy(item)}>
      <View style={s.tileImg}><Ionicons name="bag-handle" size={26} color="#E30613" /></View>
      {item.isCoachRecommended && (
        <View style={s.tileCoachBadge}>
          <Ionicons name="star" size={9} color="#F59E0B" />
          <Text style={s.tileCoachBadgeT}>Тренер</Text>
        </View>
      )}
      <Text style={s.tileName} numberOfLines={2}>{item.name}</Text>
      {item.reason && (
        <Text style={s.tileReason} numberOfLines={1} testID={`${testID}-reason`}>💡 {item.reason}</Text>
      )}
      <View style={s.tilePriceRow}>
        <Text style={s.tilePrice}>{item.price} ₴</Text>
        {item.oldPrice && item.oldPrice > item.price && <Text style={s.tileOld}>{item.oldPrice}</Text>}
      </View>
      {discount > 0 && <Text style={s.tileXp}>-{discount} ₴ за XP</Text>}
    </TouchableOpacity>
  );
}

export default function StudentMarket() {
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [coachRecommended, setCoachRecommended] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [homeData, setHomeData] = useState<any>(null);
  const [xp, setXp] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('all');
  const router = useRouter();

  const fetchData = async () => {
    try {
      const [prodRes, bundleRes, homeRes] = await Promise.allSettled([
        api.get('/marketplace/featured'),
        api.get('/marketplace/bundles'),
        api.get('/student/home'),
      ]);
      const prodData = prodRes.status === 'fulfilled' ? (prodRes.value.data || prodRes.value) : {};
      setAllProducts(prodData?.all || prodData?.products || []);
      setCoachRecommended(prodData?.coachRecommended || []);
      setBundles(bundleRes.status === 'fulfilled' ? ((bundleRes.value.data || bundleRes.value)?.bundles || []) : []);
      if (homeRes.status === 'fulfilled') {
        const hd = homeRes.value.data || homeRes.value;
        setHomeData(hd);
        setXp(hd?.gamification?.xp || hd?.xp || 0);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };
  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const handleBuy = (item: any) => {
    const discount = xp >= 50 ? Math.round(item.price * 0.05) : 0;
    const finalPrice = item.price - discount;
    Alert.alert(
      item.name,
      `${finalPrice} ₴${discount > 0 ? ` (знижка -${discount} ₴ за XP)` : ''}`,
      [{ text: 'Скасувати', style: 'cancel' }, { text: 'Замовити', onPress: () => Alert.alert('✅', 'Замовлення оформлено!') }],
    );
  };

  const belt = homeData?.junior?.belt || 'WHITE';
  const upcomingCompetitions: any[] = homeData?.junior?.upcomingCompetitions || [];

  // 🥋 Belt starter: for white/yellow → UNIFORM+PROTECTION, for higher → EQUIPMENT+ACCESSORIES
  const beltStarter = useMemo(() => {
    const isNovice = ['WHITE', 'YELLOW'].includes(belt);
    const targetCats = isNovice ? ['UNIFORM', 'PROTECTION'] : ['EQUIPMENT', 'ACCESSORIES'];
    return allProducts.filter((p: any) => targetCats.includes(p.category)).slice(0, 4);
  }, [belt, allProducts]);

  // 🏆 Before competitions: show PROTECTION + EQUIPMENT if has upcoming competition
  const beforeCompetitions = useMemo(() => {
    if (!upcomingCompetitions.length) return [];
    const targetCats = ['PROTECTION', 'EQUIPMENT', 'ACCESSORIES'];
    return allProducts.filter((p: any) => targetCats.includes(p.category)).slice(0, 4);
  }, [upcomingCompetitions, allProducts]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const filtered = category === 'all' ? allProducts : allProducts.filter(p => p.category === category);
  const nextComp = upcomingCompetitions[0];

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}
    >
      <Text style={s.title}>Маркет</Text>

      {/* XP Banner */}
      {xp >= 50 && (
        <View style={s.xpBanner} testID="market-xp-banner">
          <Ionicons name="sparkles" size={18} color="#F59E0B" />
          <Text style={s.xpBannerText}>У вас {xp} XP — знижка -5% на всі товари!</Text>
        </View>
      )}

      {/* ⭐ Тренер рекомендує */}
      {coachRecommended.length > 0 && (
        <View style={s.section} testID="market-coach-section">
          <SectionHeader
            icon="star"
            iconColor="#F59E0B"
            title="Тренер рекомендує"
            subtitle="Для твого рівня підготовки"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {coachRecommended.map((p: any, i: number) => (
              <ProductTile key={p.id || i} item={p} xp={xp} onBuy={handleBuy} testID={`coach-rec-${i}`} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 🥋 Стартовий / Під твій пояс */}
      {beltStarter.length > 0 && (
        <View style={s.section} testID="market-belt-section">
          <SectionHeader
            icon="ribbon"
            iconColor="#7C3AED"
            title="Під твій пояс"
            subtitle={BELT_STARTER_HINT[belt] || 'Товари для твого етапу'}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {beltStarter.map((p: any, i: number) => (
              <ProductTile key={p.id || i} item={p} xp={xp} onBuy={handleBuy} testID={`belt-starter-${i}`} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* 🏆 Перед змаганнями */}
      {beforeCompetitions.length > 0 && nextComp && (
        <View style={s.section} testID="market-competitions-section">
          <SectionHeader
            icon="trophy"
            iconColor="#EF4444"
            title="Підготовка до турніру"
            subtitle={`«${nextComp.name}»${nextComp.daysUntil != null ? ` · через ${nextComp.daysUntil} днів` : ''}`}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {beforeCompetitions.map((p: any, i: number) => (
              <ProductTile key={p.id || i} item={p} xp={xp} onBuy={handleBuy} testID={`before-comp-${i}`} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Divider before generic catalog */}
      <View style={s.divider} />

      {/* Categories */}
      <Text style={s.catalogLabel}>ВЕСЬ КАТАЛОГ</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow} contentContainerStyle={{ paddingRight: 16 }}>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c.key} testID={`cat-${c.key}`} style={[s.catBtn, category === c.key && s.catBtnActive]} onPress={() => setCategory(c.key)}>
            <Text style={[s.catText, category === c.key && s.catTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bundles */}
      {category === 'all' && bundles.length > 0 && (
        <View style={s.sectionPad}>
          <Text style={s.blockTitle}>Комплекти</Text>
          {bundles.map((b: any, i: number) => (
            <TouchableOpacity key={i} testID={`bundle-${i}`} style={s.bundleCard} onPress={() => handleBuy({ name: b.name, price: b.bundlePrice || b.price })}>
              <View style={s.bundleIcon}><Ionicons name="gift" size={26} color="#7C3AED" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.bundleName}>{b.name}</Text>
                <Text style={s.bundleItems}>{(b.products || b.items || []).map((p: any) => typeof p === 'string' ? p : p.name).join(' + ')}</Text>
                <View style={s.bundlePriceRow}>
                  <Text style={s.bundlePrice}>{b.bundlePrice || b.price} ₴</Text>
                  {b.totalPrice && <Text style={s.bundleOld}>{b.totalPrice} ₴</Text>}
                  {b.discountPercent && <View style={s.discBadge}><Text style={s.discText}>-{b.discountPercent}%</Text></View>}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Products Grid */}
      <View style={s.sectionPad}>
        <Text style={s.blockTitle}>{category === 'all' ? 'Товари' : CATEGORIES.find(c => c.key === category)?.label || 'Товари'}</Text>
        {filtered.length === 0 ? (
          <View style={s.emptySection}>
            <Ionicons name="bag-outline" size={36} color="#D1D5DB" />
            <Text style={s.emptyText}>Немає товарів у цій категорії</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {filtered.map((p: any, i: number) => (
              <TouchableOpacity key={i} testID={`product-${i}`} style={s.prodCard} onPress={() => handleBuy(p)}>
                <View style={s.prodImgBg}><Ionicons name="bag-handle" size={28} color="#E30613" /></View>
                <Text style={s.prodName} numberOfLines={2}>{p.name}</Text>
                {p.reason && (
                  <Text style={s.prodReason} numberOfLines={1}>💡 {p.reason}</Text>
                )}
                <View style={s.prodPriceRow}>
                  <Text style={s.prodPrice}>{p.price} ₴</Text>
                  {p.oldPrice && <Text style={s.prodOld}>{p.oldPrice} ₴</Text>}
                </View>
                {xp >= 50 && <Text style={s.prodXp}>-{Math.round(p.price * 0.05)} ₴ за XP</Text>}
                {p.isCoachRecommended && (
                  <View style={s.coachPick}>
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <Text style={s.coachPickText}>Тренер рекомендує</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  title: { fontSize: 24, fontWeight: '800', color: '#0F0F10', marginTop: 16, paddingHorizontal: 16 },

  // XP Banner
  xpBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 12, marginTop: 12, marginHorizontal: 16, borderWidth: 1, borderColor: '#FDE68A' },
  xpBannerText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#92400E' },

  // Section (horizontal scroll)
  section: { marginTop: 20, paddingLeft: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingRight: 16 },
  sectionIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F0F10' },
  sectionSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Tile (horizontal)
  tile: { width: 148, backgroundColor: '#FFF', borderRadius: 14, padding: 10, borderWidth: 1, borderColor: '#F3F4F6', position: 'relative' },
  tileImg: { width: '100%' as any, height: 80, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileCoachBadge: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: '#FDE68A' },
  tileCoachBadgeT: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  tileName: { fontSize: 12, fontWeight: '700', color: '#0F0F10', minHeight: 30 },
  tileReason: { fontSize: 10, color: '#7C3AED', fontWeight: '600', marginTop: 3 },
  tilePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 6 },
  tilePrice: { fontSize: 14, fontWeight: '800', color: '#E30613' },
  tileOld: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
  tileXp: { fontSize: 10, fontWeight: '700', color: '#F59E0B', marginTop: 3 },

  // Divider
  divider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 24, marginHorizontal: 16 },
  catalogLabel: { fontSize: 12, fontWeight: '800', color: '#9CA3AF', letterSpacing: 0.8, paddingHorizontal: 16, marginBottom: 10 },

  // Categories
  catRow: { marginBottom: 4, maxHeight: 40, paddingLeft: 16 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  catBtnActive: { backgroundColor: '#0F0F10', borderColor: '#0F0F10' },
  catText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catTextActive: { color: '#FFF' },

  sectionPad: { marginTop: 16, paddingHorizontal: 16 },
  blockTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 10 },

  // Bundles
  bundleCard: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#7C3AED20', gap: 14 },
  bundleIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  bundleName: { fontSize: 16, fontWeight: '700', color: '#0F0F10' },
  bundleItems: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  bundlePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  bundlePrice: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },
  bundleOld: { fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through' },
  discBadge: { backgroundColor: '#E30613', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Grid (generic catalog)
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  prodCard: { width: '47%' as any, backgroundColor: '#FFF', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  prodImgBg: { width: '100%' as any, height: 80, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  prodName: { fontSize: 14, fontWeight: '600', color: '#0F0F10', marginBottom: 6 },
  prodReason: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 6 },
  prodPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prodPrice: { fontSize: 16, fontWeight: '700', color: '#E30613' },
  prodOld: { fontSize: 13, color: '#9CA3AF', textDecorationLine: 'line-through' },
  prodXp: { fontSize: 12, fontWeight: '600', color: '#F59E0B', marginTop: 4 },
  coachPick: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  coachPickText: { fontSize: 11, fontWeight: '600', color: '#F59E0B' },

  emptySection: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
});
