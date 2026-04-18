import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes } from '@/theme';
import { api } from '@/lib/api';

type ProgramOption = {
  id: string;
  programType: string;
  title: string;
  description: string;
  icon: string;
  color: string;
};

const parentPrograms: ProgramOption[] = [
  {
    id: 'kids',
    programType: 'KIDS',
    title: 'Дитяча програма 4+',
    description: 'Перші кроки, дисципліна, координація, розвиток характеру',
    icon: 'happy-outline',
    color: '#22C55E'
  },
  {
    id: 'special',
    programType: 'SPECIAL',
    title: 'Особлива програма',
    description: 'Підтримка дітей з когнітивними особливостями, адаптивний підхід',
    icon: 'heart-outline',
    color: '#8B5CF6'
  },
  {
    id: 'consultation',
    programType: 'CONSULTATION',
    title: 'Потрібна консультація',
    description: 'Допоможемо підібрати правильний формат',
    icon: 'chatbubbles-outline',
    color: '#6B7280'
  }
];

const studentPrograms: ProgramOption[] = [
  {
    id: 'teen',
    programType: 'KIDS',
    title: 'Підліткова / молодша група',
    description: 'Дисципліна, фізичний розвиток, характер',
    icon: 'school-outline',
    color: '#22C55E'
  },
  {
    id: 'self_defense',
    programType: 'ADULT_SELF_DEFENSE',
    title: 'Доросла група самооборони',
    description: 'Практичні навички самозахисту та впевненість',
    icon: 'shield-outline',
    color: '#EF4444'
  },
  {
    id: 'private',
    programType: 'ADULT_PRIVATE',
    title: 'Індивідуальні заняття',
    description: 'Персональний формат під вашу ціль',
    icon: 'person-outline',
    color: '#F59E0B'
  },
  {
    id: 'consultation',
    programType: 'CONSULTATION',
    title: 'Потрібна консультація',
    description: 'Допоможемо підібрати правильний формат',
    icon: 'chatbubbles-outline',
    color: '#6B7280'
  }
];

export default function ProgramSelectScreen() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const programs = role === 'PARENT' ? parentPrograms : studentPrograms;

  const handleSelectProgram = async (programType: string) => {
    try {
      await api.post('/onboarding/select-program', { programType });
      router.push({ pathname: '/(auth)/onboarding-form', params: { programType } });
    } catch (error) {
      console.error('Error selecting program:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Оберіть напрямок</Text>
          <Text style={styles.subtitle}>
            {role === 'PARENT' 
              ? 'Який тип програми підходить для вашої дитини?' 
              : 'Який формат тренувань вас цікавить?'}
          </Text>
        </View>

        {/* Program Options */}
        <View style={styles.options}>
          {programs.map((program) => (
            <TouchableOpacity
              key={program.id}
              style={styles.programCard}
              onPress={() => handleSelectProgram(program.programType)}
              activeOpacity={0.8}
            >
              <View style={[styles.programIcon, { backgroundColor: `${program.color}15` }]}>
                <Ionicons name={program.icon as any} size={28} color={program.color} />
              </View>
              <View style={styles.programContent}>
                <Text style={styles.programTitle}>{program.title}</Text>
                <Text style={styles.programDesc}>{program.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  options: {
    gap: spacing.md,
  },
  programCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  programIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  programContent: {
    flex: 1,
  },
  programTitle: {
    fontSize: fontSizes.base,
    fontWeight: '700',
    color: colors.text,
  },
  programDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
});
