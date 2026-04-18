import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image,
  RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/lib/api';
import { useClub } from '../../src/contexts/ClubContext';
import { colors } from '../../src/theme';

type Tab = 'overview' | 'products' | 'orders' | 'inventory' | 'campaigns' | 'recommendations' | 'broadcasts';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Огляд', icon: 'analytics' },
  { id: 'products', label: 'Товари', icon: 'cube' },
  { id: 'orders', label: 'Замовлення', icon: 'receipt' },
  { id: 'inventory', label: 'Склад', icon: 'layers' },
  { id: 'campaigns', label: 'Акції', icon: 'pricetag' },
  { id: 'recommendations', label: 'Рекоменд.', icon: 'star' },
  { id: 'broadcasts', label: 'Розсилки', icon: 'megaphone' },
];

const CATEGORIES = [
  { id: 'EQUIPMENT', label: 'Екіпіровка', icon: 'fitness' },
  { id: 'UNIFORM', label: 'Форма', icon: 'shirt' },
  { id: 'PROTECTION', label: 'Захист', icon: 'shield' },
  { id: 'SPORT_NUTRITION', label: 'Спортпит', icon: 'nutrition' },
  { id: 'NUTRITION', label: 'Харчування', icon: 'fast-food' },
  { id: 'ACCESSORIES', label: 'Аксесуари', icon: 'bag-handle' },
];

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Очікує оплати', PAID: 'Оплачено', PROCESSING: 'В обробці',
  READY: 'Готово', DELIVERED: 'Доставлено', CANCELLED: 'Скасовано', CANCELED: 'Скасовано',
  NEW: 'Нове', PENDING: 'Очікує', DONE: 'Завершено',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_PAYMENT: '#F59E0B', PAID: '#10B981', PROCESSING: '#3B82F6',
  READY: '#8B5CF6', DELIVERED: '#059669', CANCELLED: '#EF4444', CANCELED: '#EF4444',
  NEW: '#6B7280', PENDING: '#F59E0B', DONE: '#059669',
};

export default function AdminMarketplaceScreen() {
  const router = useRouter();
  const { theme } = useClub();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [analytics, setAnalytics] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any>(null);
  const [inventoryLogs, setInventoryLogs] = useState<any[]>([]);
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);

  // Filter
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);

  // Create product form
  const [np, setNp] = useState({ name: '', price: '', category: 'EQUIPMENT', description: '', stock: '10', brand: '', oldPrice: '', imageBase64: '' });
  const [newCampaign, setNewCampaign] = useState({ name: '', discountPercent: '10', description: '' });
  const [broadcastData, setBroadcastData] = useState({ title: '', message: '' });

  const primaryColor = theme?.primary || '#E30613';

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, productsRes, ordersRes] = await Promise.all([
        api.get('/shop/admin/marketplace/analytics').catch(() => null),
        api.get('/shop/admin/products').catch(() => []),
        api.get('/shop/admin/orders').catch(() => []),
      ]);
      setAnalytics(analyticsRes);
      setProducts(productsRes || []);
      setOrders(ordersRes || []);

      if (tab === 'inventory') {
        const [inv, logs] = await Promise.all([
          api.get('/shop/admin/inventory').catch(() => null),
          api.get('/shop/admin/inventory/logs?limit=30').catch(() => []),
        ]);
        setInventory(inv);
        setInventoryLogs(logs || []);
      }
      if (tab === 'campaigns') {
        const c = await api.get('/shop/admin/campaigns').catch(() => []);
        setCampaignsList(c || []);
      }
      if (tab === 'recommendations') {
        const r = await api.get('/shop/admin/marketplace/recommendations').catch(() => []);
        setRecs(r || []);
      }
      if (tab === 'broadcasts') {
        const b = await api.get('/shop/admin/broadcasts').catch(() => []);
        setBroadcasts(b || []);
      }
    } catch (e) {
      console.log('Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => { setLoading(true); fetchData(); }, [tab]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  // Pick image
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setNp(p => ({ ...p, imageBase64: `data:image/jpeg;base64,${result.assets[0].base64}` }));
    }
  };

  // Create product with validation
  const createProduct = async () => {
    if (!np.name.trim()) return Alert.alert('Помилка', 'Введіть назву товару');
    if (!np.price || isNaN(Number(np.price)) || Number(np.price) <= 0) return Alert.alert('Помилка', 'Введіть коректну ціну');
    if (!np.stock || isNaN(Number(np.stock)) || Number(np.stock) < 0) return Alert.alert('Помилка', 'Введіть кількість на складі');

    try {
      const body: any = {
        name: np.name.trim(),
        price: Number(np.price),
        category: np.category,
        description: np.description.trim(),
        stock: Number(np.stock),
        brand: np.brand.trim() || undefined,
        oldPrice: np.oldPrice ? Number(np.oldPrice) : undefined,
        isActive: true,
      };
      if (np.imageBase64) body.images = [np.imageBase64];

      await api.post('/shop/products', body);
      setShowCreateProduct(false);
      setNp({ name: '', price: '', category: 'EQUIPMENT', description: '', stock: '10', brand: '', oldPrice: '', imageBase64: '' });
      fetchData();
      Alert.alert('Готово', 'Товар створено успішно');
    } catch (e: any) {
      Alert.alert('Помилка', e.response?.data?.message || 'Не вдалося створити товар');
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.put(`/shop/admin/orders/${orderId}/transition`, { status });
      fetchData();
    } catch (e: any) {
      Alert.alert('Помилка', e.response?.data?.message || 'Не вдалося оновити статус');
    }
  };

  const createCampaign = async () => {
    if (!newCampaign.name.trim()) return Alert.alert('Помилка', 'Введіть назву акції');
    if (!newCampaign.discountPercent || Number(newCampaign.discountPercent) <= 0 || Number(newCampaign.discountPercent) > 100)
      return Alert.alert('Помилка', 'Знижка від 1% до 100%');
    try {
      await api.post('/shop/admin/campaigns', {
        name: newCampaign.name.trim(),
        discountPercent: Number(newCampaign.discountPercent),
        description: newCampaign.description.trim(),
        type: 'DISCOUNT', isActive: true,
      });
      setShowCreateCampaign(false);
      setNewCampaign({ name: '', discountPercent: '10', description: '' });
      fetchData();
      Alert.alert('Готово', 'Акцію створено');
    } catch (e) { Alert.alert('Помилка', 'Не вдалося створити'); }
  };

  const sendBroadcast = async () => {
    if (!broadcastData.title.trim()) return Alert.alert('Помилка', 'Введіть заголовок');
    if (!broadcastData.message.trim()) return Alert.alert('Помилка', 'Введіть повідомлення');
    try {
      const res = await api.post('/shop/admin/broadcasts', { ...broadcastData, audience: { roles: ['PARENT', 'STUDENT'] } });
      setShowBroadcast(false);
      setBroadcastData({ title: '', message: '' });
      Alert.alert('Надіслано', `Розсилка відправлена ${res.sentTo} користувачам`);
      fetchData();
    } catch (e) { Alert.alert('Помилка', 'Не вдалося відправити'); }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const StatCard = ({ label, value, icon, color = '#0F0F10' }: any) => (
    <View style={st.statCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[st.statValue, { color }]}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ===== HEADER ===== */}
      <View style={st.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={st.headerBackBtn}>
          <Ionicons name="chevron-back" size={22} color="#0F0F10" />
        </TouchableOpacity>
        <View style={st.headerCenter}>
          <Ionicons name="storefront" size={20} color={primaryColor} />
          <Text style={st.headerTitle}>Маркетплейс</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ===== TAB BAR ===== */}
      <View style={st.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabBarContent}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t.id}
              testID={`tab-${t.id}`}
              style={[st.tabItem, tab === t.id && { borderBottomColor: primaryColor }]}
              onPress={() => setTab(t.id)}
            >
              <Ionicons name={t.icon as any} size={16} color={tab === t.id ? primaryColor : '#9CA3AF'} />
              <Text style={[st.tabText, tab === t.id && { color: primaryColor, fontWeight: '700' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ===== CONTENT ===== */}
      {loading ? (
        <ActivityIndicator size="large" color={primaryColor} style={{ flex: 1 }} />
      ) : (
        <ScrollView
          style={st.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primaryColor} />}
        >
          {/* ===== OVERVIEW ===== */}
          {tab === 'overview' && analytics && (
            <>
              <View style={st.statsGrid}>
                <StatCard label="Дохід" value={`${analytics.revenue} ₴`} icon="cash" color="#10B981" />
                <StatCard label="Замовлень" value={analytics.totalOrders} icon="receipt" color="#3B82F6" />
                <StatCard label="Сер. чек" value={`${analytics.avgOrder} ₴`} icon="trending-up" color="#8B5CF6" />
                <StatCard label="Товарів" value={analytics.totalProducts} icon="cube" color="#F59E0B" />
              </View>
              <View style={st.statsGrid}>
                <StatCard label="Оплачено" value={analytics.paidOrders} icon="checkmark-circle" color="#059669" />
                <StatCard label="Очікує" value={analytics.pendingOrders} icon="time" color="#F59E0B" />
                <StatCard label="Акцій" value={analytics.activeCampaigns} icon="pricetag" color="#EC4899" />
                <StatCard label="Low stock" value={analytics.stock?.lowStock || 0} icon="warning" color="#EF4444" />
              </View>
              {analytics.topProducts?.length > 0 && (
                <View style={st.card}>
                  <Text style={st.cardTitle}>Топ товари за продажами</Text>
                  {analytics.topProducts.slice(0, 5).map((p: any, i: number) => (
                    <View key={i} style={st.topRow}>
                      <Text style={st.topRank}>#{i + 1}</Text>
                      <Text style={st.topName} numberOfLines={1}>{p.name}</Text>
                      <Text style={st.topSales}>{p.salesCount} шт</Text>
                      <Text style={st.topRevenue}>{p.revenue} ₴</Text>
                    </View>
                  ))}
                </View>
              )}
              {analytics.topCoaches?.length > 0 && (
                <View style={st.card}>
                  <Text style={st.cardTitle}>Топ тренери (рекомендації)</Text>
                  {analytics.topCoaches.map((c: any, i: number) => (
                    <View key={i} style={st.topRow}>
                      <Text style={st.topRank}>#{i + 1}</Text>
                      <Text style={st.topName}>{c.name}</Text>
                      <Text style={st.topSales}>{c.count} рек.</Text>
                      <Text style={[st.topRevenue, { color: '#059669' }]}>{c.conversion}%</Text>
                    </View>
                  ))}
                </View>
              )}
              <View style={st.card}>
                <Text style={st.cardTitle}>Рекомендації</Text>
                <View style={st.recStats}>
                  <View style={st.recStatItem}>
                    <Text style={st.recStatValue}>{analytics.recommendations?.total || 0}</Text>
                    <Text style={st.recStatLabel}>Всього</Text>
                  </View>
                  <View style={st.recStatItem}>
                    <Text style={[st.recStatValue, { color: '#10B981' }]}>{analytics.recommendations?.purchased || 0}</Text>
                    <Text style={st.recStatLabel}>Куплено</Text>
                  </View>
                  <View style={st.recStatItem}>
                    <Text style={[st.recStatValue, { color: '#3B82F6' }]}>{analytics.recommendations?.conversionRate || 0}%</Text>
                    <Text style={st.recStatLabel}>Конверсія</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* ===== PRODUCTS ===== */}
          {tab === 'products' && (
            <>
              <TouchableOpacity testID="create-product-btn" style={[st.actionBtn, { backgroundColor: primaryColor }]} onPress={() => setShowCreateProduct(true)}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={st.actionBtnText}>Створити товар</Text>
              </TouchableOpacity>

              {/* Search & Filter */}
              <View style={st.searchRow}>
                <View style={st.searchBox}>
                  <Ionicons name="search" size={16} color="#9CA3AF" />
                  <TextInput style={st.searchInput} placeholder="Пошук..." placeholderTextColor="#9CA3AF" value={searchQuery} onChangeText={setSearchQuery} />
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.filterScroll} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                <TouchableOpacity style={[st.filterChip, filterCategory === 'ALL' && st.filterChipActive]} onPress={() => setFilterCategory('ALL')}>
                  <Text style={[st.filterChipText, filterCategory === 'ALL' && st.filterChipTextActive]}>Всі ({products.length})</Text>
                </TouchableOpacity>
                {CATEGORIES.map(c => {
                  const count = products.filter(p => p.category === c.id).length;
                  return (
                    <TouchableOpacity key={c.id} style={[st.filterChip, filterCategory === c.id && st.filterChipActive]} onPress={() => setFilterCategory(c.id)}>
                      <Text style={[st.filterChipText, filterCategory === c.id && st.filterChipTextActive]}>{c.label} ({count})</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Products list */}
              {filteredProducts.map((p: any) => (
                <View key={p._id} style={st.productCard}>
                  <View style={st.productImgBox}>
                    {p.images?.[0] ? (
                      <Image source={{ uri: p.images[0] }} style={st.productImg} />
                    ) : (
                      <Ionicons name="cube-outline" size={28} color="#D1D5DB" />
                    )}
                  </View>
                  <View style={st.productInfo}>
                    <Text style={st.productName} numberOfLines={1}>{p.name}</Text>
                    <Text style={st.productMeta}>{CATEGORIES.find(c => c.id === p.category)?.label || p.category} {p.brand ? `• ${p.brand}` : ''}</Text>
                    <View style={st.productPriceRow}>
                      <Text style={st.productPrice}>{p.price} ₴</Text>
                      {p.oldPrice && <Text style={st.productOldPrice}>{p.oldPrice} ₴</Text>}
                    </View>
                  </View>
                  <View style={st.productRight}>
                    <Text style={[st.productStock, p.stock <= 5 && { color: '#EF4444' }]}>{p.stock} шт</Text>
                    <View style={[st.statusDot, { backgroundColor: p.isActive ? '#10B981' : '#EF4444' }]} />
                  </View>
                </View>
              ))}
              {filteredProducts.length === 0 && <Text style={st.empty}>Товарів не знайдено</Text>}
            </>
          )}

          {/* ===== ORDERS ===== */}
          {tab === 'orders' && (
            <>
              {orders.length === 0 && <Text style={st.empty}>Замовлень ще немає</Text>}
              {orders.map((o: any) => {
                const oid = (o.id || o._id || '').toString();
                return (
                  <View key={oid} style={st.orderCard}>
                    <View style={st.orderHeader}>
                      <Text style={st.orderNum}>#{oid.slice(-6).toUpperCase()}</Text>
                      <View style={[st.orderStatusBadge, { backgroundColor: (STATUS_COLORS[o.status] || '#6B7280') + '20' }]}>
                        <Text style={[st.orderStatusText, { color: STATUS_COLORS[o.status] || '#6B7280' }]}>{STATUS_LABELS[o.status] || o.status}</Text>
                      </View>
                    </View>
                    <Text style={st.orderUser}>{o.userName || 'Клієнт'} • {o.totalAmount} ₴</Text>
                    <Text style={st.orderDate}>{o.createdAt ? new Date(o.createdAt).toLocaleDateString('uk-UA') : ''}</Text>
                    <View style={st.orderActions}>
                      {o.status === 'PENDING_PAYMENT' && (
                        <TouchableOpacity style={[st.orderActionBtn, { backgroundColor: '#10B981' }]} onPress={() => updateOrderStatus(oid, 'PAID')}>
                          <Text style={st.orderActionText}>Оплачено ✓</Text>
                        </TouchableOpacity>
                      )}
                      {o.status === 'PAID' && (
                        <TouchableOpacity style={[st.orderActionBtn, { backgroundColor: '#3B82F6' }]} onPress={() => updateOrderStatus(oid, 'PROCESSING')}>
                          <Text style={st.orderActionText}>В обробку</Text>
                        </TouchableOpacity>
                      )}
                      {o.status === 'PROCESSING' && (
                        <TouchableOpacity style={[st.orderActionBtn, { backgroundColor: '#8B5CF6' }]} onPress={() => updateOrderStatus(oid, 'READY')}>
                          <Text style={st.orderActionText}>Готово</Text>
                        </TouchableOpacity>
                      )}
                      {o.status === 'READY' && (
                        <TouchableOpacity style={[st.orderActionBtn, { backgroundColor: '#059669' }]} onPress={() => updateOrderStatus(oid, 'DELIVERED')}>
                          <Text style={st.orderActionText}>Видано</Text>
                        </TouchableOpacity>
                      )}
                      {['PENDING_PAYMENT', 'PAID'].includes(o.status) && (
                        <TouchableOpacity style={[st.orderActionBtn, { backgroundColor: '#EF4444' }]} onPress={() => updateOrderStatus(oid, 'CANCELLED')}>
                          <Text style={st.orderActionText}>Скасувати</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* ===== INVENTORY ===== */}
          {tab === 'inventory' && inventory && (
            <>
              <View style={st.statsGrid}>
                <StatCard label="Загалом" value={inventory.totalStock} icon="layers" color="#3B82F6" />
                <StatCard label="Зарезерв." value={inventory.totalReserved} icon="lock-closed" color="#F59E0B" />
                <StatCard label="Low stock" value={inventory.lowStockCount} icon="warning" color="#EF4444" />
                <StatCard label="Немає" value={inventory.outOfStockCount} icon="close-circle" color="#DC2626" />
              </View>
              {inventory.lowStockProducts?.length > 0 && (
                <View style={st.card}>
                  <Text style={st.cardTitle}>⚠️ Мало на складі</Text>
                  {inventory.lowStockProducts.map((p: any) => (
                    <View key={p.id} style={st.invRow}>
                      <Text style={st.invName} numberOfLines={1}>{p.name}</Text>
                      <Text style={[st.invStock, { color: '#EF4444' }]}>{p.stock} шт</Text>
                    </View>
                  ))}
                </View>
              )}
              {inventory.outOfStockProducts?.length > 0 && (
                <View style={st.card}>
                  <Text style={st.cardTitle}>🔴 Немає в наявності</Text>
                  {inventory.outOfStockProducts.map((p: any) => (
                    <View key={p.id} style={st.invRow}>
                      <Text style={st.invName}>{p.name}</Text>
                      <Text style={[st.invStock, { color: '#DC2626' }]}>0</Text>
                    </View>
                  ))}
                </View>
              )}
              {inventoryLogs.length > 0 && (
                <View style={st.card}>
                  <Text style={st.cardTitle}>Журнал операцій</Text>
                  {inventoryLogs.slice(0, 15).map((l: any, i: number) => (
                    <View key={i} style={st.logRow}>
                      <Text style={st.logType}>{l.type}</Text>
                      <Text style={st.logName} numberOfLines={1}>{l.productName}</Text>
                      <Text style={st.logQty}>{l.quantity > 0 ? '+' : ''}{l.quantity}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ===== CAMPAIGNS ===== */}
          {tab === 'campaigns' && (
            <>
              <TouchableOpacity testID="create-campaign-btn" style={[st.actionBtn, { backgroundColor: primaryColor }]} onPress={() => setShowCreateCampaign(true)}>
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={st.actionBtnText}>Нова акція</Text>
              </TouchableOpacity>
              {campaignsList.map((c: any) => (
                <View key={c._id} style={st.campCard}>
                  <View style={st.campLeft}>
                    <View style={st.campDiscBadge}>
                      <Text style={st.campDiscText}>-{c.discountPercent}%</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={st.campName}>{c.name}</Text>
                    <Text style={st.campMeta}>{(c.productIds || []).length} товарів • {c.isActive ? 'Активна' : 'Неактивна'}</Text>
                  </View>
                  <View style={[st.statusDot, { backgroundColor: c.isActive ? '#10B981' : '#6B7280' }]} />
                </View>
              ))}
              {campaignsList.length === 0 && <Text style={st.empty}>Акцій ще немає. Створіть першу!</Text>}
            </>
          )}

          {/* ===== RECOMMENDATIONS ===== */}
          {tab === 'recommendations' && (
            <>
              {recs.map((r: any, i: number) => (
                <View key={r._id || i} style={st.recCard}>
                  <Ionicons name="star" size={16} color="#7C3AED" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={st.recProduct}>{r.productName}</Text>
                    <Text style={st.recCoach}>{r.coachName} → {r.studentName || 'Всім'}</Text>
                    {r.reason && <Text style={st.recReason}>"{r.reason}"</Text>}
                  </View>
                  <View style={[st.recStatusBadge, { backgroundColor: r.status === 'PURCHASED' ? '#D1FAE5' : r.status === 'ACTIVE' ? '#DBEAFE' : '#F3F4F6' }]}>
                    <Text style={[st.recStatusText, { color: r.status === 'PURCHASED' ? '#059669' : r.status === 'ACTIVE' ? '#3B82F6' : '#6B7280' }]}>
                      {r.status === 'PURCHASED' ? 'Куплено' : r.status === 'ACTIVE' ? 'Активна' : 'Видалена'}
                    </Text>
                  </View>
                </View>
              ))}
              {recs.length === 0 && <Text style={st.empty}>Рекомендацій ще немає</Text>}
            </>
          )}

          {/* ===== BROADCASTS ===== */}
          {tab === 'broadcasts' && (
            <>
              <TouchableOpacity testID="create-broadcast-btn" style={[st.actionBtn, { backgroundColor: primaryColor }]} onPress={() => setShowBroadcast(true)}>
                <Ionicons name="megaphone" size={20} color="#fff" />
                <Text style={st.actionBtnText}>Нова розсилка</Text>
              </TouchableOpacity>
              {broadcasts.map((b: any, i: number) => (
                <View key={i} style={st.broadCard}>
                  <Text style={st.broadTitle}>{b.title}</Text>
                  <Text style={st.broadMsg} numberOfLines={2}>{b.message}</Text>
                  <Text style={st.broadMeta}>{b.sentTo} отримувачів • {b.createdAt ? new Date(b.createdAt).toLocaleDateString('uk-UA') : ''}</Text>
                </View>
              ))}
              {broadcasts.length === 0 && <Text style={st.empty}>Розсилок ще немає</Text>}
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ===== CREATE PRODUCT MODAL ===== */}
      <Modal visible={showCreateProduct} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={st.modal}>
            <View style={st.modalContent}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={st.modalTitle}>Новий товар</Text>

                {/* Image picker */}
                <TouchableOpacity testID="pick-image" style={st.imgPicker} onPress={pickImage}>
                  {np.imageBase64 ? (
                    <Image source={{ uri: np.imageBase64 }} style={st.imgPreview} />
                  ) : (
                    <View style={st.imgPlaceholder}>
                      <Ionicons name="camera" size={32} color="#9CA3AF" />
                      <Text style={st.imgPlaceholderText}>Додати фото</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={st.fieldLabel}>Назва *</Text>
                <TextInput style={st.input} placeholder="Назва товару" value={np.name} onChangeText={v => setNp(p => ({ ...p, name: v }))} />

                <Text style={st.fieldLabel}>Категорія</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6 }}>
                  {CATEGORIES.map(c => (
                    <TouchableOpacity key={c.id} style={[st.catChip, np.category === c.id && st.catChipActive]} onPress={() => setNp(p => ({ ...p, category: c.id }))}>
                      <Text style={[st.catChipText, np.category === c.id && st.catChipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.fieldLabel}>Ціна *</Text>
                    <TextInput style={st.input} placeholder="0" keyboardType="numeric" value={np.price} onChangeText={v => setNp(p => ({ ...p, price: v }))} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={st.fieldLabel}>Стара ціна</Text>
                    <TextInput style={st.input} placeholder="—" keyboardType="numeric" value={np.oldPrice} onChangeText={v => setNp(p => ({ ...p, oldPrice: v }))} />
                  </View>
                </View>

                <View style={st.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.fieldLabel}>Кількість *</Text>
                    <TextInput style={st.input} placeholder="10" keyboardType="numeric" value={np.stock} onChangeText={v => setNp(p => ({ ...p, stock: v }))} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={st.fieldLabel}>Бренд</Text>
                    <TextInput style={st.input} placeholder="АТАКА" value={np.brand} onChangeText={v => setNp(p => ({ ...p, brand: v }))} />
                  </View>
                </View>

                <Text style={st.fieldLabel}>Опис</Text>
                <TextInput style={[st.input, { height: 70, textAlignVertical: 'top' }]} placeholder="Опис товару..." multiline value={np.description} onChangeText={v => setNp(p => ({ ...p, description: v }))} />

                <View style={st.modalBtns}>
                  <TouchableOpacity style={st.cancelBtn} onPress={() => setShowCreateProduct(false)}>
                    <Text style={st.cancelText}>Скасувати</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.confirmBtn, { backgroundColor: primaryColor }]} onPress={createProduct}>
                    <Text style={st.confirmText}>Створити</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ===== CAMPAIGN MODAL ===== */}
      <Modal visible={showCreateCampaign} animationType="slide" transparent>
        <View style={st.modal}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Нова акція</Text>
            <Text style={st.fieldLabel}>Назва *</Text>
            <TextInput style={st.input} placeholder="Назва акції" value={newCampaign.name} onChangeText={v => setNewCampaign(p => ({ ...p, name: v }))} />
            <Text style={st.fieldLabel}>Знижка % *</Text>
            <TextInput style={st.input} placeholder="10" keyboardType="numeric" value={newCampaign.discountPercent} onChangeText={v => setNewCampaign(p => ({ ...p, discountPercent: v }))} />
            <Text style={st.fieldLabel}>Опис</Text>
            <TextInput style={[st.input, { height: 60 }]} placeholder="Опис акції" multiline value={newCampaign.description} onChangeText={v => setNewCampaign(p => ({ ...p, description: v }))} />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setShowCreateCampaign(false)}><Text style={st.cancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[st.confirmBtn, { backgroundColor: primaryColor }]} onPress={createCampaign}><Text style={st.confirmText}>Створити</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===== BROADCAST MODAL ===== */}
      <Modal visible={showBroadcast} animationType="slide" transparent>
        <View style={st.modal}>
          <View style={st.modalContent}>
            <Text style={st.modalTitle}>Нова розсилка</Text>
            <Text style={st.fieldLabel}>Заголовок *</Text>
            <TextInput style={st.input} placeholder="Заголовок розсилки" value={broadcastData.title} onChangeText={v => setBroadcastData(p => ({ ...p, title: v }))} />
            <Text style={st.fieldLabel}>Повідомлення *</Text>
            <TextInput style={[st.input, { height: 80 }]} placeholder="Текст повідомлення" multiline value={broadcastData.message} onChangeText={v => setBroadcastData(p => ({ ...p, message: v }))} />
            <View style={st.modalBtns}>
              <TouchableOpacity style={st.cancelBtn} onPress={() => setShowBroadcast(false)}><Text style={st.cancelText}>Скасувати</Text></TouchableOpacity>
              <TouchableOpacity style={[st.confirmBtn, { backgroundColor: primaryColor }]} onPress={sendBroadcast}><Text style={st.confirmText}>Надіслати</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F0F10' },

  // Tab bar
  tabBarWrapper: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tabBarContent: { paddingHorizontal: 12, gap: 0 },
  tabItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent', flexDirection: 'row', alignItems: 'center', gap: 5 },
  tabText: { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },

  // Content
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },

  // Stats
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', gap: 4, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#6B7280', fontWeight: '500' },

  // Cards
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F0F10', marginBottom: 12 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  topRank: { width: 28, fontSize: 13, fontWeight: '700', color: '#6B7280' },
  topName: { flex: 1, fontSize: 13, color: '#0F0F10' },
  topSales: { fontSize: 12, color: '#6B7280', marginRight: 8 },
  topRevenue: { fontSize: 13, fontWeight: '700', color: '#0F0F10', minWidth: 60, textAlign: 'right' },

  // Recommendation stats
  recStats: { flexDirection: 'row', justifyContent: 'space-around' },
  recStatItem: { alignItems: 'center' },
  recStatValue: { fontSize: 22, fontWeight: '800', color: '#0F0F10' },
  recStatLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Action button
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 16 },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Search & Filter
  searchRow: { marginBottom: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#0F0F10' },
  filterScroll: { marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#0F0F10', borderColor: '#0F0F10' },
  filterChipText: { fontSize: 12, fontWeight: '500', color: '#6B7280' },
  filterChipTextActive: { color: '#fff' },

  // Product card
  productCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  productImgBox: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  productImg: { width: 52, height: 52, borderRadius: 10 },
  productInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 14, fontWeight: '600', color: '#0F0F10' },
  productMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  productPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  productPrice: { fontSize: 15, fontWeight: '700', color: '#E30613' },
  productOldPrice: { fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through' },
  productRight: { alignItems: 'flex-end', gap: 4 },
  productStock: { fontSize: 13, fontWeight: '600', color: '#0F0F10' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  // Orders
  orderCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 1 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: 15, fontWeight: '700', color: '#0F0F10' },
  orderStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  orderStatusText: { fontSize: 12, fontWeight: '600' },
  orderUser: { fontSize: 13, color: '#4B5563', marginTop: 4 },
  orderDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  orderActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  orderActionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  orderActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Inventory
  invRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  invName: { fontSize: 13, color: '#0F0F10', flex: 1 },
  invStock: { fontSize: 14, fontWeight: '700' },
  logRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  logType: { fontSize: 10, fontWeight: '600', color: '#6B7280', width: 80 },
  logName: { flex: 1, fontSize: 12, color: '#374151' },
  logQty: { fontSize: 13, fontWeight: '700', color: '#0F0F10' },

  // Campaigns
  campCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  campLeft: {},
  campDiscBadge: { backgroundColor: '#FEF2F2', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  campDiscText: { fontSize: 16, fontWeight: '800', color: '#E30613' },
  campName: { fontSize: 14, fontWeight: '600', color: '#0F0F10' },
  campMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  // Recommendations
  recCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  recProduct: { fontSize: 14, fontWeight: '600', color: '#0F0F10' },
  recCoach: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  recReason: { fontSize: 12, color: '#4B5563', marginTop: 2, fontStyle: 'italic' },
  recStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recStatusText: { fontSize: 11, fontWeight: '600' },

  // Broadcasts
  broadCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  broadTitle: { fontSize: 14, fontWeight: '700', color: '#0F0F10' },
  broadMsg: { fontSize: 13, color: '#4B5563', marginTop: 4 },
  broadMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },

  // Empty
  empty: { textAlign: 'center', color: '#9CA3AF', fontSize: 14, marginTop: 40, marginBottom: 20 },

  // Modal
  modal: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0F0F10', marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, marginBottom: 12, color: '#0F0F10' },
  row: { flexDirection: 'row' },
  imgPicker: { alignSelf: 'center', marginBottom: 16 },
  imgPreview: { width: 100, height: 100, borderRadius: 16 },
  imgPlaceholder: { width: 100, height: 100, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  imgPlaceholderText: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F3F4F6' },
  catChipActive: { backgroundColor: '#0F0F10' },
  catChipText: { fontSize: 13, fontWeight: '500', color: '#4B5563' },
  catChipTextActive: { color: '#fff' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  confirmText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
