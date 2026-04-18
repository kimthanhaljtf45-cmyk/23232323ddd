import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
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

function StepItem({ number, text }: { number: number; text: string }) {
  return (
    <View style={styles.stepItem}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

export default function SuccessScreen() {
  const router = useRouter();
  const { name, reset } = useOnboardingStore();
  const { user, checkAuth } = useStore();
  const displayName = name?.split(' ')[0] || user?.firstName || '';
  const [loading, setLoading] = useState(false);

  const handleGoHome = async () => {
    reset();
    
    // Якщо користувач авторизований - завершуємо onboarding і йдемо на dashboard
    if (user) {
      setLoading(true);
      try {
        // Завершуємо onboarding - це оновить isOnboarded=true
        await api.submitOnboarding({});
        // Оновлюємо user з сервера
        await checkAuth();
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
      // Неавторизований - йдемо на welcome для входу
      router.replace('/(auth)/welcome');
    }
  };

  const handleLogin = () => {
    reset();
    router.replace('/(auth)/login');
  };

  const handleLogout = async () => {
    const { logout } = useStore.getState();
    await logout();
    reset();
    router.replace('/(auth)/welcome');
  };

  // Якщо авторизований - показуємо інший контент
  const isAuthenticated = !!user;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header with Logout */}
      {isAuthenticated && (
        <View style={styles.header}>
          <View style={{ width: 44 }} />
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#E30613" />
          </Pressable>
        </View>
      )}
      
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.successIcon}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {displayName ? `Дякуємо, ${displayName}!` : 'Дякуємо!'}
        </Text>
        <Text style={styles.subtitle}>Ваша заявка прийнята</Text>
        <Text style={styles.description}>
          Ми зв'яжемось з вами найближчим часом для підбору групи та запису на пробне заняття.
        </Text>

        {/* Steps */}
        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>Що далі?</Text>
          <View style={styles.stepsList}>
            {isAuthenticated ? (
              <>
                <StepItem number={1} text="Перейдіть до розкладу занять" />
                <StepItem number={2} text="Оберіть зручний час для візиту" />
                <StepItem number={3} text="Приходьте на перше тренування" />
              </>
            ) : (
              <>
                <StepItem number={1} text="Наш менеджер зателефонує вам" />
                <StepItem number={2} text="Підберемо зручний час для візиту" />
                <StepItem number={3} text="Приходьте на безкоштовне пробне заняття" />
              </>
            )}
          </View>
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaSection}>
        {loading ? (
          <View style={styles.primaryBtn}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <PrimaryButton onPress={handleGoHome}>
            {isAuthenticated ? 'Перейти в кабінет' : 'На головну'}
          </PrimaryButton>
        )}
        {!isAuthenticated && (
          <Pressable style={styles.loginLink} onPress={handleLogin}>
            <Text style={styles.loginLinkText}>У мене вже є акаунт</Text>
          </Pressable>
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
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logoutButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#22C55E',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F10',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  stepsCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 16,
  },
  stepsList: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E30613',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  stepText: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  ctaSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
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
  loginLink: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});
