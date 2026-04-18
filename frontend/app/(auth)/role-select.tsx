import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSizes, fontWeights } from '@/theme';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';

type RoleOption = {
  id: string;
  role: 'PARENT' | 'STUDENT';
  title: string;
  description: string;
  icon: string;
};

const roleOptions: RoleOption[] = [
  {
    id: 'parent',
    role: 'PARENT',
    title: 'Батьки / Опікун',
    description: 'Керую тренуваннями, розвитком і прогресом дитини',
    icon: 'people-outline'
  },
  {
    id: 'student',
    role: 'STUDENT',
    title: 'Учень / Дорослий учасник',
    description: 'Слідкую за своїм шляхом, тренуваннями та прогресом',
    icon: 'fitness-outline'
  }
];

export default function RoleSelectScreen() {
  const { user } = useStore();

  const handleSelectRole = async (role: 'PARENT' | 'STUDENT') => {
    try {
      await api.post('/auth/select-role', { role });
      router.push({ pathname: '/(auth)/program-select', params: { role } });
    } catch (error) {
      console.error('Error selecting role:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Хто ви?</Text>
          <Text style={styles.subtitle}>Оберіть, як ви будете користуватись додатком</Text>
        </View>

        {/* Role Options */}
        <View style={styles.options}>
          {roleOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.optionCard}
              onPress={() => handleSelectRole(option.role)}
              activeOpacity={0.8}
            >
              <View style={styles.optionIcon}>
                <Ionicons name={option.icon as any} size={32} color={colors.primary} />
              </View>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDesc}>{option.description}</Text>
              <View style={styles.optionArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.text} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Coach/Admin Note */}
        <TouchableOpacity style={styles.coachNote}>
          <Ionicons name="key-outline" size={20} color={colors.textSecondary} />
          <Text style={styles.coachNoteText}>Я тренер, у мене є запрошення</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
  },
  header: {
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
  },
  subtitle: {
    fontSize: fontSizes.base,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  options: {
    gap: spacing.md,
  },
  optionCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  optionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.text,
  },
  optionDesc: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  optionArrow: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coachNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
    marginTop: 'auto',
  },
  coachNoteText: {
    fontSize: fontSizes.sm,
    color: colors.textSecondary,
  },
});
