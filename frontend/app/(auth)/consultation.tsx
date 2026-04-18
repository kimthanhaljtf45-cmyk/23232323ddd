import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/theme';
import { createConsultation, CreateConsultationPayload } from '@/modules/consultation/api';

type ProgramType = 'KIDS' | 'SPECIAL' | 'ADULT_SELF_DEFENSE' | 'ADULT_PRIVATE' | 'CONSULTATION';
type RoleType = 'PARENT' | 'STUDENT';

const PROGRAMS = [
  { id: 'KIDS', title: 'Дитяча програма 4+', icon: 'people-outline', description: 'Фізичний розвиток та дисципліна' },
  { id: 'SPECIAL', title: 'Особлива програма', icon: 'heart-outline', description: 'Адаптивний підхід' },
  { id: 'ADULT_SELF_DEFENSE', title: 'Самооборона для дорослих', icon: 'shield-outline', description: 'Практичні навички' },
  { id: 'ADULT_PRIVATE', title: 'Персональні тренування', icon: 'person-outline', description: 'Індивідуальні заняття' },
  { id: 'CONSULTATION', title: 'Потрібна консультація', icon: 'help-circle-outline', description: 'Допоможемо обрати' },
];

export default function ConsultationScreen() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form state
  const [role, setRole] = useState<RoleType>('PARENT');
  const [programType, setProgramType] = useState<ProgramType>('KIDS');
  const [fullName, setFullName] = useState('');
  const [childName, setChildName] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');
  const [goal, setGoal] = useState('');

  const isParent = role === 'PARENT';
  const isChildProgram = programType === 'KIDS' || programType === 'SPECIAL';

  const handleSubmit = async () => {
    if (!fullName.trim() || !phone.trim()) {
      Alert.alert('Помилка', "Будь ласка, заповніть обов'язкові поля");
      return;
    }

    if (isParent && isChildProgram && !childName.trim()) {
      Alert.alert('Помилка', "Вкажіть ім'я дитини");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateConsultationPayload = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        role,
        programType,
        goal: goal.trim() || undefined,
      };

      if (isParent && isChildProgram) {
        payload.childName = childName.trim();
        if (age) {
          payload.age = parseInt(age, 10);
        }
      }

      await createConsultation(payload);
      
      Alert.alert(
        'Заявку відправлено!',
        "Ми зв'яжемося з вами найближчим часом для уточнення деталей та запису на пробне заняття.",
        [{ text: 'OK', onPress: () => router.replace('/(auth)/welcome') }]
      );
    } catch (error) {
      Alert.alert('Помилка', 'Не вдалося відправити заявку. Спробуйте ще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Запис на консультацію</Text>
            <Text style={styles.subtitle}>
              Залиште заявку, і ми підберемо правильну програму
            </Text>
          </View>

          {/* Role Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Хто ви?</Text>
            <View style={styles.roleButtons}>
              <TouchableOpacity
                style={[styles.roleButton, role === 'PARENT' && styles.roleButtonActive]}
                onPress={() => setRole('PARENT')}
              >
                <Ionicons 
                  name="people-outline" 
                  size={24} 
                  color={role === 'PARENT' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.roleButtonText, role === 'PARENT' && styles.roleButtonTextActive]}>
                  Батьки
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, role === 'STUDENT' && styles.roleButtonActive]}
                onPress={() => setRole('STUDENT')}
              >
                <Ionicons 
                  name="person-outline" 
                  size={24} 
                  color={role === 'STUDENT' ? colors.primary : colors.textSecondary} 
                />
                <Text style={[styles.roleButtonText, role === 'STUDENT' && styles.roleButtonTextActive]}>
                  Я сам учень
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Program Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Програма</Text>
            {PROGRAMS.map((program) => (
              <TouchableOpacity
                key={program.id}
                style={[
                  styles.programButton,
                  programType === program.id && styles.programButtonActive,
                ]}
                onPress={() => setProgramType(program.id as ProgramType)}
              >
                <Ionicons 
                  name={program.icon as any} 
                  size={24} 
                  color={programType === program.id ? colors.primary : colors.textSecondary} 
                />
                <View style={styles.programInfo}>
                  <Text style={[
                    styles.programTitle,
                    programType === program.id && styles.programTitleActive,
                  ]}>
                    {program.title}
                  </Text>
                  <Text style={styles.programDesc}>{program.description}</Text>
                </View>
                {programType === program.id && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Contact Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Контактна інформація</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ваше ім'я *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Введіть ім'я"
                placeholderTextColor={colors.textTertiary}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Телефон *</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+380"
                placeholderTextColor={colors.textTertiary}
                keyboardType="phone-pad"
              />
            </View>

            {isParent && isChildProgram && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Ім'я дитини *</Text>
                  <TextInput
                    style={styles.input}
                    value={childName}
                    onChangeText={setChildName}
                    placeholder="Введіть ім'я дитини"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Вік дитини</Text>
                  <TextInput
                    style={styles.input}
                    value={age}
                    onChangeText={setAge}
                    placeholder="Вік"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                  />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ваша мета (опційно)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={goal}
                onChangeText={setGoal}
                placeholder="Що хочете досягти?"
                placeholderTextColor={colors.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Відправляємо...' : 'Відправити заявку'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Ми зв'яжемося з вами протягом 24 годин
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
    marginBottom: spacing.md,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  roleButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleButtonText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  roleButtonTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  programButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  programButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  programInfo: {
    flex: 1,
  },
  programTitle: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  programTitleActive: {
    color: colors.primary,
  },
  programDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.backgroundSecondary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.button,
    color: colors.background,
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
