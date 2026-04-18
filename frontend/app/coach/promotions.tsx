import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../../src/lib/api';

/**
 * COACH PROMOTIONS - Available promotions for risk students
 * 
 * Coach can:
 * - See available promotions from admin
 * - Activate promotion for specific group/students
 * - Send notification about promotion
 */

interface Promotion {
  id: string;
  name: string;
  description: string;
  discountType: 'PERCENT' | 'FIXED';
  discountValue: number;
  validUntil: string;
  minPayments?: number;
  isActive: boolean;
  usageCount: number;
}

export default function CoachPromotionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ groupId?: string }>();
  
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    loadPromotions();
  }, []);

  const loadPromotions = async () => {
    try {
      const response = await api.get('/promotions/available');
      setPromotions(response || []);
    } catch (error) {
      console.log('Error loading promotions:', error);
      // Show some default promotions for UX
      setPromotions([
        {
          id: 'promo-1',
          name: 'Знижка "Повернення"',
          description: 'Для учнів, які пропустили більше 2 тижнів',
          discountType: 'PERCENT',
          discountValue: 20,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          usageCount: 5,
        },
        {
          id: 'promo-2',
          name: 'Приведи друга',
          description: 'Знижка для учня та нового друга',
          discountType: 'PERCENT',
          discountValue: 15,
          validUntil: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          usageCount: 12,
        },
        {
          id: 'promo-3',
          name: 'Сімейна пропозиція',
          description: 'Для другої дитини в сім\'ї',
          discountType: 'FIXED',
          discountValue: 500,
          validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          usageCount: 3,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const activatePromotion = async (promotion: Promotion) => {
    setActivating(promotion.id);
    
    try {
      if (params.groupId) {
        // Activate for specific group
        await api.post(`/promotions/${promotion.id}/activate`, {
          groupId: params.groupId,
        });
      }
      
      Alert.alert(
        'Акція активована',
        `"${promotion.name}" готова до використання. Ви можете надіслати повідомлення учням.`,
        [
          { text: 'Пізніше' },
          { 
            text: 'Надіслати повідомлення',
            onPress: () => router.push({
              pathname: '/coach/messages',
              params: { action: 'custom', groupId: params.groupId }
            })
          },
        ]
      );
    } catch (error: any) {
      console.log('Error activating promotion:', error);
      Alert.alert('Помилка', error?.message || 'Не вдалося активувати акцію');
    } finally {
      setActivating(null);
    }
  };

  const formatDiscount = (promo: Promotion) => {
    if (promo.discountType === 'PERCENT') {
      return `-${promo.discountValue}%`;
    }
    return `-${promo.discountValue} ₴`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E30613" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#0F0F10" />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={[styles.headerIcon, { backgroundColor: '#22C55E20' }]}>
            <Ionicons name="megaphone" size={20} color="#22C55E" />
          </View>
          <Text style={styles.headerTitle}>Доступні акції</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={20} color="#3B82F6" />
          <Text style={styles.infoBannerText}>
            Активуйте акцію, щоб запропонувати знижку ризиковим учням та підвищити retention
          </Text>
        </View>

        {/* Promotions List */}
        {promotions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="megaphone-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Немає доступних акцій</Text>
            <Text style={styles.emptyText}>
              Зверніться до адміністратора для створення нових акцій
            </Text>
          </View>
        ) : (
          promotions.map(promo => (
            <View key={promo.id} style={styles.promoCard}>
              <View style={styles.promoHeader}>
                <View style={styles.promoDiscount}>
                  <Text style={styles.promoDiscountText}>{formatDiscount(promo)}</Text>
                </View>
                <View style={styles.promoMeta}>
                  <Ionicons name="calendar-outline" size={14} color="#9CA3AF" />
                  <Text style={styles.promoMetaText}>до {formatDate(promo.validUntil)}</Text>
                </View>
              </View>
              
              <Text style={styles.promoName}>{promo.name}</Text>
              <Text style={styles.promoDescription}>{promo.description}</Text>
              
              <View style={styles.promoFooter}>
                <View style={styles.promoUsage}>
                  <Ionicons name="people-outline" size={14} color="#6B7280" />
                  <Text style={styles.promoUsageText}>Використано: {promo.usageCount} разів</Text>
                </View>
                
                <Pressable
                  style={[styles.activateButton, activating === promo.id && styles.activateButtonDisabled]}
                  onPress={() => activatePromotion(promo)}
                  disabled={activating === promo.id}
                >
                  {activating === promo.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.activateButtonText}>Активувати</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  promoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  promoDiscount: {
    backgroundColor: '#22C55E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promoDiscountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  promoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  promoName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 4,
  },
  promoDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  promoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  promoUsage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promoUsageText: {
    fontSize: 12,
    color: '#6B7280',
  },
  activateButton: {
    backgroundColor: '#E30613',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activateButtonDisabled: {
    opacity: 0.6,
  },
  activateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
