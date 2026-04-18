import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, borderRadius, shadows } from '@/theme';
import { DashboardBlock } from '../hooks/useDashboard';

// Block Components
import { CriticalAlertsBlock } from './blocks/CriticalAlertsBlock';
import { ChildrenOverviewBlock } from './blocks/ChildrenOverviewBlock';
import { QuickActionsBlock } from './blocks/QuickActionsBlock';
import { MonthlyGoalsBlock } from './blocks/MonthlyGoalsBlock';
import { NextTrainingsBlock } from './blocks/NextTrainingsBlock';
import { FeedPreviewBlock } from './blocks/FeedPreviewBlock';
import { PaymentStatusBlock } from './blocks/PaymentStatusBlock';
import { BeltReadyBlock } from './blocks/BeltReadyBlock';
import { ChildStabilityBlock } from './blocks/ChildStabilityBlock';
import { WelcomeCTABlock } from './blocks/WelcomeCTABlock';
import { ProgramsOverviewBlock } from './blocks/ProgramsOverviewBlock';
import { LocationsBlock } from './blocks/LocationsBlock';
import { ContactActionsBlock } from './blocks/ContactActionsBlock';

interface DashboardBlockRendererProps {
  block: DashboardBlock;
}

export function DashboardBlockRenderer({ block }: DashboardBlockRendererProps) {
  switch (block.type) {
    case 'CRITICAL_ALERTS':
      return <CriticalAlertsBlock items={block.items} />;
    case 'CHILDREN_OVERVIEW':
      return <ChildrenOverviewBlock items={block.items} />;
    case 'QUICK_ACTIONS':
      return <QuickActionsBlock items={block.items} />;
    case 'MONTHLY_GOALS':
      return <MonthlyGoalsBlock items={block.items} />;
    case 'NEXT_TRAININGS':
      return <NextTrainingsBlock items={block.items} />;
    case 'FEED_PREVIEW':
      return <FeedPreviewBlock items={block.items} />;
    case 'PAYMENT_STATUS':
      return <PaymentStatusBlock items={block.items} />;
    case 'BELT_READY':
      return <BeltReadyBlock items={block.items} />;
    case 'CHILD_STABILITY':
      return <ChildStabilityBlock items={block.items} />;
    case 'WELCOME_CTA':
      return <WelcomeCTABlock items={block.items} />;
    case 'PROGRAMS_OVERVIEW':
      return <ProgramsOverviewBlock items={block.items} />;
    case 'LOCATIONS':
      return <LocationsBlock items={block.items} />;
    case 'CONTACT_ACTIONS':
      return <ContactActionsBlock items={block.items} />;
    case 'NOTIFICATIONS_PREVIEW':
      return null; // TODO: Implement
    case 'MY_BELT':
    case 'MY_PROGRESS':
    case 'MY_RATING':
    case 'MY_GOALS':
    case 'MY_ACHIEVEMENTS':
    case 'NEXT_TRAINING':
    case 'PRIORITY_ACTIONS':
    case 'TODAY_SCHEDULES':
    case 'GROUP_HEALTH':
    case 'KPI':
    case 'ATTENDANCE_HEALTH':
    case 'REVENUE':
      return <GenericBlock type={block.type} items={block.items} />;
    default:
      return null;
  }
}

// Generic block for unimplemented types
function GenericBlock({ type, items }: { type: string; items: any[] }) {
  return (
    <View style={styles.genericBlock}>
      <Text style={styles.genericTitle}>{type}</Text>
      <Text style={styles.genericCount}>{items.length} елементів</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  genericBlock: {
    backgroundColor: colors.background,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  genericTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  genericCount: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
