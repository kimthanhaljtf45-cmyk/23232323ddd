/**
 * АТАКА - Frozen Enums
 * Sprint 4: Core Domain Model
 */

export type UserRole = 'PARENT' | 'STUDENT' | 'COACH' | 'OWNER' | 'ADMIN';

export type ProgramType =
  | 'KIDS'
  | 'SPECIAL'
  | 'SELF_DEFENSE'
  | 'MENTORSHIP'
  | 'CONSULTATION';

export type SubscriptionStatus =
  | 'PENDING_START'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED';

export type InvoiceStatus =
  | 'PENDING'
  | 'PENDING_REVIEW'
  | 'PAID'
  | 'OVERDUE'
  | 'REJECTED';

export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'TRIAL'
  | 'CONVERTED'
  | 'LOST';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'WARNED' | 'LATE';

export type Belt = 'WHITE' | 'YELLOW' | 'ORANGE' | 'GREEN' | 'BLUE' | 'BROWN' | 'BLACK';
