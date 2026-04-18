/**
 * ATAKA - FROZEN DOMAIN MODEL
 * ============================
 * DO NOT MODIFY WITHOUT ARCHITECTURAL DECISION
 * ============================
 */

// ROLES - FROZEN
export const ROLES = ['PARENT', 'STUDENT', 'COACH', 'ADMIN'] as const;
export type Role = typeof ROLES[number];

// PROGRAMS - FROZEN
export const PROGRAMS = ['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'] as const;
export type ProgramType = typeof PROGRAMS[number];

// PRICING - FROZEN (base values, editable via admin)
export const BASE_PRICING: Record<ProgramType, number> = {
  KIDS: 2000,
  SPECIAL: 2000,
  SELF_DEFENSE: 3000,
  MENTORSHIP: 5000,
  CONSULTATION: 0,
};

// PROGRAM LABELS - FROZEN
export const PROGRAM_LABELS: Record<ProgramType, string> = {
  KIDS: 'Дитяча програма',
  SPECIAL: 'Особлива програма',
  SELF_DEFENSE: 'Самооборона',
  MENTORSHIP: 'Персональні тренування',
  CONSULTATION: 'Консультація',
};

// SUBSCRIPTION STATES - FROZEN
export const SUBSCRIPTION_STATES = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;
export type SubscriptionState = typeof SUBSCRIPTION_STATES[number];

// PAYMENT STATES - FROZEN
export const PAYMENT_STATES = ['PENDING', 'UNDER_REVIEW', 'PAID', 'REJECTED', 'OVERDUE'] as const;
export type PaymentState = typeof PAYMENT_STATES[number];

// CONSULTATION FUNNEL - FROZEN
export const CONSULTATION_STAGES = ['NEW', 'CONTACTED', 'BOOKED_TRIAL', 'TRIAL_DONE', 'CONVERTED', 'LOST'] as const;
export type ConsultationStage = typeof CONSULTATION_STAGES[number];

// ATTENDANCE STATES - FROZEN
export const ATTENDANCE_STATES = ['PRESENT', 'ABSENT', 'WARNED', 'LATE'] as const;
export type AttendanceState = typeof ATTENDANCE_STATES[number];

// BELT PROGRESSION - FROZEN
export const BELTS = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'] as const;
export type Belt = typeof BELTS[number];

// Currency - FROZEN
export const CURRENCY = 'UAH' as const;
