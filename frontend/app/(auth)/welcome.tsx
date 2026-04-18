import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ATAKA_LOGO_BASE64 } from '../../src/constants/logo';
const logoSource = { uri: ATAKA_LOGO_BASE64 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ProgramCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

function ProgramCard({ icon, title, description, color }: ProgramCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.programCard, animatedStyle]}
      onPressIn={() => {
        scale.value = withSpring(0.97);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
    >
      <View style={[styles.programIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <View style={styles.programInfo}>
        <Text style={styles.programTitle}>{title}</Text>
        <Text style={styles.programDescription}>{description}</Text>
      </View>
    </AnimatedPressable>
  );
}

function PrimaryButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[styles.primaryButton, animatedStyle]}
      onPressIn={() => {
        scale.value = withSpring(0.97);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      onPress={onPress}
    >
      <Text style={styles.primaryButtonText}>{title}</Text>
    </AnimatedPressable>
  );
}

function SecondaryButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
    >
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image 
            source={logoSource}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Hero Text */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            Виховуємо силу.{"\n"}Дисципліну.{"\n"}Характер.
          </Text>
          <Text style={styles.heroSubtitle}>
            Не просто тренування — формуємо особистість
          </Text>
        </View>

        {/* Program Cards */}
        <View style={styles.programsSection}>
          <Text style={styles.sectionTitle}>Оберіть напрям:</Text>

          <ProgramCard
            icon="people"
            title="Дитяча програма"
            description="Фізичний розвиток + дисципліна + характер"
            color="#3B82F6"
          />

          <ProgramCard
            icon="heart"
            title="Особлива програма"
            description="Індивідуальний підхід до розвитку"
            color="#EC4899"
          />

          <ProgramCard
            icon="shield-checkmark"
            title="Самооборона"
            description="Впевненість + контроль + практичні навички"
            color="#10B981"
          />
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <PrimaryButton
            title="Записатися на пробне заняття"
            onPress={() => router.push('/(auth)/onboarding')}
          />

          <SecondaryButton
            title="Увійти"
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  logo: {
    width: 140,
    height: 140,
  },
  logoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#E30613',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F0F10',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  programsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  programIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  programInfo: {
    flex: 1,
  },
  programTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F0F10',
    marginBottom: 4,
  },
  programDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  ctaSection: {
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#E30613',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#E30613',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E30613',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E30613',
  },
});
