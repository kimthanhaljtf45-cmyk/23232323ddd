import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useOnboardingStore } from '../../../src/store/onboarding';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PrimaryButton({ onPress, children }: { onPress: () => void; children: string }) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.primaryBtn, animatedStyle]}
      onPressIn={() => { scale.value = withSpring(0.97); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
    >
      <Text style={styles.primaryBtnText}>{children}</Text>
    </AnimatedPressable>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <View style={styles.checkItem}>
      <View style={styles.checkIcon}>
        <Ionicons name="checkmark" size={18} color="#fff" />
      </View>
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

export default function MotivationScreen() {
  const router = useRouter();
  const { target, reset } = useOnboardingStore();
  const { user, checkAuth } = useStore();
  const isChild = target === 'CHILD';
  const [loading, setLoading] = useState(false);

  const benefits = isChild
    ? [
        'Дисципліна та самоконтроль',
        'Впевненість у собі',
        'Фізична форма та здоров\'я',
        'Вміння захистити себе',
      ]
    : [
        'Впевненість у конфліктах',
        'Контроль ситуацій',
        'Фізична готовність',
        'Ментальна стійкість',
      ];

  const timeframe = isChild ? '3 місяці' : '2 місяці';

  const handleContinue = async () => {
    // Якщо користувач авторизований - завершуємо onboarding і йдемо на dashboard
    if (user) {
      setLoading(true);
      try {
        // Завершуємо onboarding
        await api.submitOnboarding({});
        // Оновлюємо дані користувача
        await checkAuth();
        // Скидаємо onboarding store
        reset();
        // Переходимо на головну
        router.replace('/(tabs)');
      } catch (err) {
        console.error('Complete onboarding error:', err);
        // Все одно спробуємо перейти
        router.replace('/(tabs)');
      } finally {
        setLoading(false);
      }
    } else {
      // Неавторизований - йдемо на форму заявки
      router.push('/(auth)/onboarding/contact');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '75%' }]} />
          </View>
          <Text style={styles.progressText}>Крок 3 з 4</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Що ви отримаєте?</Text>
        <Text style={styles.subtitle}>Через {timeframe} регулярних занять:</Text>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          {benefits.map((benefit, index) => (
            <CheckItem key={index} text={benefit} />
          ))}
        </View>

        {/* Quote */}
        <View style={styles.quoteSection}>
          <Text style={styles.quoteText}>
            "{isChild ? 'Найкраща інвестиція — у майбутнє дитини' : 'Сила — це не м\'язи, це впевненість'}"
          </Text>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        {loading ? (
          <View style={styles.primaryBtn}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <PrimaryButton onPress={handleContinue}>
            {user ? 'Перейти в кабінет' : 'Залишити заявку'}
          </PrimaryButton>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E30613',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F10',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
  },
  benefitsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    gap: 16,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkText: {
    fontSize: 16,
    color: '#0F0F10',
    fontWeight: '500',
    flex: 1,
  },
  quoteSection: {
    marginTop: 32,
    paddingHorizontal: 16,
  },
  quoteText: {
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 24,
  },
  ctaSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  primaryBtn: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
