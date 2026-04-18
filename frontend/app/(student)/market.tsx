import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/lib/api';
import { PressScale, FadeInUp, Toast } from '../../src/components/motion';

/**
 * JUNIOR X10 Sprint 3 — МАРКЕТ (контекстна монетизація)
 * FINISH X10 — premium card polish:
 *  - white cards + shadow-sm (no flat gray)
 *  - bigger image padding
 *  - bolder price
 *  - tap scale 0.97
 *  - fade-in on scroll
 *  - social proof chip "🔥 Купили N учнів"
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

// Deterministic social proof: maps product id → "12-58 уч." (stable per product)
function socialProof(item: any): number {
  const id = String(item?.id || item?._id || item?.name || '');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 12 + (h % 47); // 12..58
}

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

function ProductTile({ item, xp, onBuy, testID, urgency }: any) {
  const discount = xp >= 50 ? Math.round((item.price || 0) * 0.05) : 0;
  const bought = socialProof(item);
  // X10 FIX: context-specific urgency chip (overrides generic "reason")
  const reasonText = urgency || item.reason;
  return (
    <PressScale testID={testID} onPress={() => onBuy(item)} style={s.tile as any}>
      <View style={s.tileImg}><Ionicons name="bag-handle" size={34} color="#E30613" /></View>
      {item.isCoachRecommended && (
        <View style={s.tileCoachBadge}>
          <Ionicons name="star" size={9} color="#F59E0B" />
          <Text style={s.tileCoachBadgeT}>Тренер</Text>
        </View>
      )}
      <Text style={s.tileName} numberOfLines={2}>{item.name}</Text>
      {reasonText && (
        <View style={[s.urgencyChip, urgency ? s.urgencyChipStrong : null] as any}>
          <Text style={[s.tileReason, urgency ? s.urgencyTextStrong : null]} numberOfLines={1} testID={`${testID}-reason`}>
            {urgency ? '🔥 ' : '💡 '}{reasonText}
          </Text>
        </View>
      )}
      <View style={s.tilePriceRow}>
        <Text style={s.tilePrice}>{item.price} ₴</Text>
        {item.oldPrice && item.oldPrice > item.price && <Text style={s.tileOld}>{item.oldPrice}</Text>}
      </View>
      {discount > 0 && <Text style={s.tileXp}>-{discount} ₴ за XP</Text>}
      {/* X10 FINAL: Purchase reward — "покупка → рост" */}
      <View style={s.xpRewardChip}>
        <Ionicons name="sparkles" size={9} color="#065F46" />
        <Text style={s.xpRewardT}>+5 XP · +1 дисципліна</Text>
      </View>
      <View style={s.socialProof}>
        <Ionicons name="flame" size={10} color="#F97316" />
        <Text style={s.socialProofT}>Купили {bought} учнів</Text>
      </View>
    </PressScale>
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
  const [toast, setToast] = useState<{ visible: boolean; text: string }>({ visible: false, text: '' });
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
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Замовити',
          onPress: () => setToast({ visible: true, text: '✅ Замовлення оформлено · +5 XP · +1 дисципліна' }),
        },
      ],
    );
  };

  const belt = homeData?.junior?.belt || 'WHITE';
  const upcomingCompetitions: any[] = homeData?.junior?.upcomingCompetitions || [];

  const beltStarter = useMemo(() => {
    const isNovice = ['WHITE', 'YELLOW'].includes(belt);
    const targetCats = isNovice ? ['UNIFORM', 'PROTECTION'] : ['EQUIPMENT', 'ACCESSORIES'];
    return allProducts.filter((p: any) => targetCats.includes(p.category)).slice(0, 4);
  }, [belt, allProducts]);

  const beforeCompetitions = useMemo(() => {
    if (!upcomingCompetitions.length) return [];
    const targetCats = ['PROTECTION', 'EQUIPMENT', 'ACCESSORIES'];
    return allProducts.filter((p: any) => targetCats.includes(p.category)).slice(0, 4);
  }, [upcomingCompetitions, allProducts]);

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#E30613" /></View>;

  const filtered = category === 'all' ? allProducts : allProducts.filter(p => p.category === category);
  const nextComp = upcomingCompetitions[0];

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <Toast visible={toast.visible} text={toast.text} tone="success" onHide={() => setToast({ visible: false, text: '' })} />
      <ScrollView
        style={s.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#E30613" />}
      >
        {/* Header */}
        <FadeInUp>
          <View style={s.headerBar}>
            <Text style={s.title}>Маркет</Text>
          </View>
        </FadeInUp>

        {/* XP Banner */}
        {xp >= 50 && (
          <FadeInUp delay={60}>
            <View style={s.xpBanner} testID="market-xp-banner">
              <Ionicons name="sparkles" size={18} color="#F59E0B" />
              <Text style={s.xpBannerText}>У вас {xp} XP — знижка -5% на всі товари!</Text>
            </View>
          </FadeInUp>
        )}

        {/* ⭐ Тренер рекомендує */}
        {coachRecommended.length > 0 && (
          <FadeInUp delay={120}>
            <View style={s.section} testID="market-coach-section">
              <SectionHeader icon="star" iconColor="#F59E0B" title="Тренер рекомендує" subtitle="Для твого рівня підготовки" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                {coachRecommended.map((p: any, i: number) => (
                  <ProductTile key={p.id || i} item={p} xp={xp} onBuy={handleBuy} testID={`coach-rec-${i}`} urgency="Тренер рекомендує для цього етапу" />
                ))}
              </ScrollView>
            </View>
          </FadeInUp>
        )}

        {/* 🥋 Під твій пояс */}
        {beltStarter.length > 0 && (
          <FadeInUp delay={180}>
            <View style={s.section} testID="market-belt-section">
              <SectionHeader icon="ribbon" iconColor="#7C3AED" title="Під твій пояс" subtitle={BELT_STARTER_HINT[belt] || 'Товари для твого етапу'} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                {beltStarter.map((p: any, i: number) => (
                  <ProductTile key={p.id || i} item={p} xp={xp} onBuy={handleBuy} testID={`belt-starter-${i}`} urgency="Тобі не вистачає — для твого рівня" />
                ))}
              </ScrollView>
            </View>
          </FadeInUp>
        )}

        {/* 🏆 Перед змаганнями */}
        {beforeCompetitions.length > 0 && nextComp && (
          <FadeInUp delay={240}>
            <View style={s.section} testID="market-competitions-section">
              <SectionHeader icon="trophy" iconColor="#EF4444" title="Підготовка до турніру" subtitle={`«${nextComp.name}»${nextComp.daysUntil != null ? ` · через ${nextComp.daysUntil} днів` : ''}`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }}>
                {beforeCompetitions.map((p: any, i: number) => (
                  <ProductTile key={p.id || i} item={p} xp={xp} onBuy={handleBuy} testID={`before-comp-${i}`} urgency={`Потрібно до турніру · ${nextComp.daysUntil || 14} днів`} />
                ))}
              </ScrollView>
            </View>
          </FadeInUp>
        )}

        <View style={s.divider} />

        <Text style={s.catalogLabel}>ВЕСЬ КАТАЛОГ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catRow} contentContainerStyle={{ paddingRight: 16 }}>
          {CATEGORIES.map(c => (
            <PressScale key={c.key} testID={`cat-${c.key}`} onPress={() => setCategory(c.key)} style={[s.catBtn, category === c.key && s.catBtnActive] as any}>
              <Text style={[s.catText, category === c.key && s.catTextActive]}>{c.label}</Text>
            </PressScale>
          ))}
        </ScrollView>

        {/* Bundles */}
        {category === 'all' && bundles.length > 0 && (
          <FadeInUp delay={80}>
            <View style={s.sectionPad}>
              <Text style={s.blockTitle}>Комплекти</Text>
              {bundles.map((b: any, i: number) => (
                <PressScale key={i} testID={`bundle-${i}`} onPress={() => handleBuy({ name: b.name, price: b.bundlePrice || b.price })} style={s.bundleCard as any}>
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
                </PressScale>
              ))}
            </View>
          </FadeInUp>
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
              {filtered.map((p: any, i: number) => {
                const bought = socialProof(p);
                return (
                  <PressScale key={i} testID={`product-${i}`} onPress={() => handleBuy(p)} style={s.prodCard as any}>
                    <View style={s.prodImgBg}><Ionicons name="bag-handle" size={34} color="#E30613" /></View>
                    <Text style={s.prodName} numberOfLines={2}>{p.name}</Text>
                    {p.reason && (
                      <Text style={s.prodReason} numberOfLines={1}>💡 {p.reason}</Text>
                    )}
                    <View style={s.prodPriceRow}>
                      <Text style={s.prodPrice}>{p.price} ₴</Text>
                      {p.oldPrice && <Text style={s.prodOld}>{p.oldPrice} ₴</Text>}
                    </View>
                    {xp >= 50 && <Text style={s.prodXp}>-{Math.round(p.price * 0.05)} ₴ за XP</Text>}
                    {/* X10 FINAL: Purchase reward chip */}
                    <View style={s.xpRewardChip}>
                      <Ionicons name="sparkles" size={9} color="#065F46" />
                      <Text style={s.xpRewardT}>+5 XP · +1 дисципліна</Text>
                    </View>
                    {p.isCoachRecommended && (
                      <View style={s.coachPick}>
                        <Ionicons name="star" size={11} color="#F59E0B" />
                        <Text style={s.coachPickText}>Тренер рекомендує</Text>
                      </View>
                    )}
                    <View style={s.socialProof}>
                      <Ionicons name="flame" size={10} color="#F97316" />
                      <Text style={s.socialProofT}>Купили {bought} учнів</Text>
                    </View>
                  </PressScale>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const SHADOW_SM = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
};

const SHADOW_MD = {
  shadowColor: '#0F172A',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },

  // Header — premium feel (72px)
  headerBar: {
    height: 72,
    paddingHorizontal: 16,
    paddingBottom: 8,
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F4',
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#0F0F10', letterSpacing: -0.3 },

  // XP Banner
  xpBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, marginTop: 16, marginHorizontal: 16, borderWidth: 1, borderColor: '#FDE68A' },
  xpBannerText: { flex: 1, fontSize: 14, fontWeight: '700', color: '#92400E' },

  // Section (horizontal scroll) — vertical rhythm 24
  section: { marginTop: 24, paddingLeft: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 16 },
  sectionIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  sectionSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Tile (premium) — Level 1 card: white + shadow-sm, no border
  tile: {
    width: 160,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    position: 'relative',
    ...SHADOW_SM,
  },
  tileImg: { width: '100%' as any, height: 104, borderRadius: 12, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileCoachBadge: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FFFBEB', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: '#FDE68A' },
  tileCoachBadgeT: { fontSize: 9, fontWeight: '800', color: '#92400E' },
  tileName: { fontSize: 13, fontWeight: '700', color: '#0F0F10', minHeight: 34 },
  urgencyChip: { marginTop: 6 },
  urgencyChipStrong: {
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  urgencyTextStrong: { color: '#B91C1C', fontWeight: '800', opacity: 1 },
  tileReason: { fontSize: 10, color: '#7C3AED', fontWeight: '600', opacity: 0.85 },
  tilePriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 },
  tilePrice: { fontSize: 17, fontWeight: '900', color: '#0F0F10' },
  tileOld: { fontSize: 11, color: '#9CA3AF', textDecorationLine: 'line-through' },
  tileXp: { fontSize: 10, fontWeight: '700', color: '#F59E0B', marginTop: 4 },

  socialProof: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  socialProofT: { fontSize: 10, fontWeight: '700', color: '#F97316' },
  // X10 FINAL: XP reward chip — "покупка → рост"
  xpRewardChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  xpRewardT: { fontSize: 10, fontWeight: '800', color: '#065F46' },

  // Divider
  divider: { height: 1, backgroundColor: '#F1F1F4', marginVertical: 28, marginHorizontal: 16 },
  catalogLabel: { fontSize: 11, fontWeight: '800', color: '#9CA3AF', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 12 },

  // Categories
  catRow: { marginBottom: 4, maxHeight: 44, paddingLeft: 16 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, backgroundColor: '#FFF', marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  catBtnActive: { backgroundColor: '#0F0F10', borderColor: '#0F0F10' },
  catText: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  catTextActive: { color: '#FFF' },

  sectionPad: { marginTop: 20, paddingHorizontal: 16 },
  blockTitle: { fontSize: 17, fontWeight: '800', color: '#0F0F10', marginBottom: 12 },

  // Bundles — Level 1
  bundleCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 14,
    ...SHADOW_SM,
  },
  bundleIcon: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  bundleName: { fontSize: 16, fontWeight: '800', color: '#0F0F10' },
  bundleItems: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  bundlePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  bundlePrice: { fontSize: 20, fontWeight: '900', color: '#0F0F10' },
  bundleOld: { fontSize: 13, color: '#9CA3AF', textDecorationLine: 'line-through' },
  discBadge: { backgroundColor: '#E30613', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  discText: { color: '#FFF', fontSize: 11, fontWeight: '800' },

  // Grid — Level 1 cards
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  prodCard: {
    width: '47%' as any,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 14,
    ...SHADOW_SM,
  },
  prodImgBg: { width: '100%' as any, height: 104, borderRadius: 12, backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  prodName: { fontSize: 14, fontWeight: '700', color: '#0F0F10', marginBottom: 6 },
  prodReason: { fontSize: 11, color: '#7C3AED', fontWeight: '600', marginBottom: 6, opacity: 0.85 },
  prodPriceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  prodPrice: { fontSize: 18, fontWeight: '900', color: '#0F0F10' },
  prodOld: { fontSize: 13, color: '#9CA3AF', textDecorationLine: 'line-through' },
  prodXp: { fontSize: 12, fontWeight: '700', color: '#F59E0B', marginTop: 6 },
  coachPick: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  coachPickText: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },

  emptySection: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },
});
