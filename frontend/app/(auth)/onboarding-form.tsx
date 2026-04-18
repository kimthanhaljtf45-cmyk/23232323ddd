import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes } from '@/theme';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';

const programTitles: Record<string, string> = {
  KIDS: 'Дитяча програма',
  SPECIAL: 'Особлива програма',
  ADULT_SELF_DEFENSE: 'Самооборона',
  ADULT_PRIVATE: 'Індивідуальні заняття',
  CONSULTATION: 'Консультація'
};

const programDescriptions: Record<string, string> = {
  KIDS: 'Формуємо дисципліну, координацію та впевненість з раннього віку',
  SPECIAL: 'Делікатний, уважний і адаптивний формат розвитку',
  ADULT_SELF_DEFENSE: 'Практичні навички самозахисту, впевненість і контроль',
  ADULT_PRIVATE: 'Персональний формат під вашу ціль і ритм',
  CONSULTATION: 'Допоможемо підібрати правильний формат'
};

export default function OnboardingFormScreen() {
  const { programType } = useLocalSearchParams<{ programType: string }>();
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [childName, setChildName] = useState('');
  const [age, setAge] = useState('');
  const [district, setDistrict] = useState('');
  const [goal, setGoal] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [preferredDays, setPreferredDays] = useState<string[]>([]);

  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

  const toggleDay = (day: string) => {
    setPreferredDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      await api.post('/onboarding/submit', {
        childName: childName || undefined,
        age: age ? parseInt(age) : undefined,
        district: district || undefined,
        goal: goal || undefined,
        specialNotes: specialNotes || undefined,
        preferredSchedule: preferredDays.length > 0 ? preferredDays : undefined
      });
      router.push('/(auth)/recommendation');
    } catch (error) {
      console.error('Error submitting onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isKidsOrSpecial = programType === 'KIDS' || programType === 'SPECIAL';
  const isConsultation = programType === 'CONSULTATION';

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.flex} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.programBadge}>
              <Text style={styles.programBadgeText}>{programTitles[programType || 'KIDS']}</Text>
            </View>
            <Text style={styles.title}>Розкажіть про себе</Text>
            <Text style={styles.subtitle}>{programDescriptions[programType || 'KIDS']}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            {isKidsOrSpecial && (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>Ім'я дитини</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Артем"
                    value={childName}
                    onChangeText={setChildName}
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Вік</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="7"
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </>
            )}

            {!isKidsOrSpecial && !isConsultation && (
              <View style={styles.field}>
                <Text style={styles.label}>Ваша ціль</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Самозахист, фізична форма, впевненість..."
                  value={goal}
                  onChangeText={setGoal}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            )}

            <View style={styles.field}>
              <Text style={styles.label}>Район Києва</Text>
              <TextInput
                style={styles.input}
                placeholder="Оболонь"
                value={district}
                onChangeText={setDistrict}
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Зручні дні</Text>
              <View style={styles.daysRow}>
                {days.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayChip,
                      preferredDays.includes(day) && styles.dayChipActive
                    ]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[
                      styles.dayChipText,
                      preferredDays.includes(day) && styles.dayChipTextActive
                    ]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {programType === 'SPECIAL' && (
              <View style={styles.field}>
                <Text style={styles.label}>Додаткова інформація (за бажанням)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Що важливо знати тренеру?"
                  value={specialNotes}
                  onChangeText={setSpecialNotes}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.textTertiary}
                />
                <Text style={styles.hint}>
                  Ця інформація допоможе підібрати комфортний формат
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <Button
            title="Продовжити"
            onPress={handleSubmit}
            loading={isLoading}
            size="lg"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
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
  programBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  programBadgeText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: '#fff',
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
  form: {
    gap: spacing.lg,
  },
  field: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: fontSizes.base,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  daysRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipText: {
    fontSize: fontSizes.sm,
    fontWeight: '500',
    color: colors.text,
  },
  dayChipTextActive: {
    color: '#fff',
  },
  hint: {
    fontSize: fontSizes.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
