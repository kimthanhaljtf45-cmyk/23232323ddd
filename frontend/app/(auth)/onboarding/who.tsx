import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
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

interface ChoiceCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

function ChoiceCard({ icon, title, description, onPress }: ChoiceCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.choiceCard, animatedStyle]}
      onPressIn={() => { scale.value = withSpring(0.97); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
    >
      <View style={styles.choiceIcon}>
        <Ionicons name={icon} size={32} color="#E30613" />
      </View>
      <View style={styles.choiceContent}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </AnimatedPressable>
  );
}

export default function WhoScreen() {
  const router = useRouter();
  const { setTarget } = useOnboardingStore();
  const { user, checkAuth } = useStore();
  const [loading, setLoading] = useState(false);

  const handleChoice = async (target: 'CHILD' | 'SELF') => {
    setTarget(target);
    
    // Якщо користувач авторизований - оновлюємо роль та йдемо на вибір програми
    if (user) {
      setLoading(true);
      try {
        const role = target === 'CHILD' ? 'PARENT' : 'STUDENT';
        await api.selectOnboardingProgram(target === 'CHILD' ? 'KIDS' : 'ADULT_SELF_DEFENSE');
        router.push('/(auth)/onboarding/program');
      } catch (err) {
        console.error('Onboarding error:', err);
        Alert.alert('Помилка', 'Не вдалося зберегти вибір. Спробуйте ще раз.');
      } finally {
        setLoading(false);
      }
    } else {
      // Неавторизований - просто продовжуємо flow
      router.push('/(auth)/onboarding/program');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '25%' }]} />
          </View>
          <Text style={styles.progressText}>Крок 1 з 4</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Для кого заняття?</Text>
        <Text style={styles.subtitle}>Оберіть, щоб ми підібрали програму</Text>

        {/* Choices */}
        <View style={styles.choicesContainer}>
          <ChoiceCard
            icon="people"
            title="Для дитини"
            description="Дисципліна, розвиток, впевненість"
            onPress={() => handleChoice('CHILD')}
          />
          <ChoiceCard
            icon="person"
            title="Для себе"
            description="Самооборона, сила, контроль"
            onPress={() => handleChoice('SELF')}
          />
        </View>
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
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 32,
  },
  choicesContainer: {
    gap: 16,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  choiceIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  choiceContent: {
    flex: 1,
  },
  choiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 4,
  },
  choiceDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
});
