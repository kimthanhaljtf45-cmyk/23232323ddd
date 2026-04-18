import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ProgramCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
}

function ProgramCard({ icon, title, description, onPress }: ProgramCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.programCard, animatedStyle]}
      onPressIn={() => { scale.value = withSpring(0.97); }}
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
    >
      <View style={styles.programIcon}>
        <Ionicons name={icon} size={28} color="#E30613" />
      </View>
      <View style={styles.programContent}>
        <Text style={styles.programTitle}>{title}</Text>
        <Text style={styles.programDesc}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#9CA3AF" />
    </AnimatedPressable>
  );
}

export default function ProgramScreen() {
  const router = useRouter();
  const { target, setProgram } = useOnboardingStore();
  const isChild = target === 'CHILD';

  const handleChoice = (program: string) => {
    setProgram(program);
    router.push('/(auth)/onboarding/motivation');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.content}>
        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.progressText}>Крок 2 з 4</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Оберіть програму</Text>
        <Text style={styles.subtitle}>
          {isChild ? 'Програми для дітей від 4 років' : 'Програми для дорослих'}
        </Text>

        {/* Programs */}
        <View style={styles.programsContainer}>
          {isChild ? (
            <>
              <ProgramCard
                icon="fitness"
                title="Дитяча програма (4+)"
                description="Дисципліна, розвиток, поясна система"
                onPress={() => handleChoice('KIDS')}
              />
              <ProgramCard
                icon="heart"
                title="Особлива програма"
                description="Індивідуальний підхід, стабільність"
                onPress={() => handleChoice('SPECIAL')}
              />
            </>
          ) : (
            <>
              <ProgramCard
                icon="shield-checkmark"
                title="Самооборона"
                description="Захист, впевненість, реакція"
                onPress={() => handleChoice('ADULT_SELF_DEFENSE')}
              />
              <ProgramCard
                icon="trending-up"
                title="Менторство"
                description="Контроль, сила, стратегія"
                onPress={() => handleChoice('ADULT_PRIVATE')}
              />
            </>
          )}
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
  programsContainer: {
    gap: 16,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  programIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  programContent: {
    flex: 1,
  },
  programTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 4,
  },
  programDesc: {
    fontSize: 14,
    color: '#6B7280',
  },
});
