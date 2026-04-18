/**
 * ATAKA - FROZEN DOMAIN MODEL (Frontend)
 * ============================
 * DO NOT MODIFY WITHOUT ARCHITECTURAL DECISION
 * ============================
 */

// ROLES - FROZEN
export const ROLES = ['PARENT', 'STUDENT', 'COACH', 'ADMIN'] as const;
export type Role = typeof ROLES[number];

// PUBLIC UX MAPPING
export const PUBLIC_ROLE_OPTIONS = [
  { id: 'child', label: 'Для дитини', role: 'PARENT' as Role, description: 'Записати дитину на тренування' },
  { id: 'self', label: 'Для себе', role: 'STUDENT' as Role, description: 'Самооборона для дорослих' },
] as const;

// PROGRAMS - FROZEN
export const PROGRAMS = ['KIDS', 'SPECIAL', 'SELF_DEFENSE', 'MENTORSHIP', 'CONSULTATION'] as const;
export type ProgramType = typeof PROGRAMS[number];

// BASE PRICING - FROZEN (грн)
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

// PROGRAM DESCRIPTIONS - FROZEN
export const PROGRAM_DESCRIPTIONS: Record<ProgramType, string> = {
  KIDS: 'Фізичний розвиток + дисципліна + характер',
  SPECIAL: 'Індивідуальний підхід до розвитку',
  SELF_DEFENSE: 'Впевненість + контроль + практичні навички',
  MENTORSHIP: 'Персональний тренер для максимального результату',
  CONSULTATION: 'Безкоштовна консультація',
};

// SUBSCRIPTION STATES - FROZEN
export const SUBSCRIPTION_STATES = ['ACTIVE', 'PAUSED', 'CANCELLED'] as const;
export type SubscriptionState = typeof SUBSCRIPTION_STATES[number];

export const SUBSCRIPTION_STATE_LABELS: Record<SubscriptionState, string> = {
  ACTIVE: 'Активна',
  PAUSED: 'На паузі',
  CANCELLED: 'Скасована',
};

// PAYMENT STATES - FROZEN
export const PAYMENT_STATES = ['PENDING', 'UNDER_REVIEW', 'PAID', 'REJECTED', 'OVERDUE'] as const;
export type PaymentState = typeof PAYMENT_STATES[number];

export const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  PENDING: 'Очікує оплати',
  UNDER_REVIEW: 'На перевірці',
  PAID: 'Оплачено',
  REJECTED: 'Відхилено',
  OVERDUE: 'Прострочено',
};

// BELT PROGRESSION - FROZEN
export const BELTS = ['WHITE', 'YELLOW', 'ORANGE', 'GREEN', 'BLUE', 'BROWN', 'BLACK'] as const;
export type Belt = typeof BELTS[number];

export const BELT_LABELS: Record<Belt, string> = {
  WHITE: 'Білий',
  YELLOW: 'Жовтий',
  ORANGE: 'Помаранчевий',
  GREEN: 'Зелений',
  BLUE: 'Синій',
  BROWN: 'Коричневий',
  BLACK: 'Чорний',
};

export const BELT_COLORS: Record<Belt, string> = {
  WHITE: '#FFFFFF',
  YELLOW: '#FCD34D',
  ORANGE: '#F97316',
  GREEN: '#22C55E',
  BLUE: '#3B82F6',
  BROWN: '#92400E',
  BLACK: '#000000',
};

// Currency - FROZEN
export const CURRENCY = 'UAH';
export const CURRENCY_SYMBOL = '₴';
