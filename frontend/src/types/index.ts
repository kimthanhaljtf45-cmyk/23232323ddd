// User roles
export type UserRole = 'GUEST' | 'PARENT' | 'STUDENT' | 'COACH' | 'OWNER' | 'ADMIN';

// User status
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_VERIFICATION';

// Auth state
export type AuthState = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'pending_otp';

// Payment status
export type PaymentStatus = 'PENDING' | 'UNDER_REVIEW' | 'PAID' | 'REJECTED' | 'OVERDUE';

// Invoice status
export type InvoiceStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';

// Subscription status
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

// Attendance status  
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'WARNED' | 'LATE' | 'CANCELLED';

// Feed post types
export type FeedPostType = 'NEWS' | 'EVENT' | 'ANNOUNCEMENT' | 'RESULT';

// Feed visibility
export type FeedVisibility = 'GLOBAL' | 'GROUP' | 'LOCATION';

// Notification types
export type NotificationType = 
  | 'INVOICE_CREATED' 
  | 'PAYMENT_OVERDUE' 
  | 'PAYMENT_CONFIRMED' 
  | 'PAYMENT_APPROVED' 
  | 'PAYMENT_REJECTED'
  | 'REMINDER'
  | 'ESCALATION';

// User interface
export interface User {
  id: string;
  phone: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  status: UserStatus;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Child interface
export interface Child {
  id: string;
  firstName: string;
  lastName?: string;
  birthDate?: string;
  status: UserStatus;
  note?: string;
  groupId?: string;
  group?: Group;
  coach?: User;
  location?: Location;
  attendance?: AttendanceStats;
  goal?: MonthlyGoal;
  achievements?: Achievement[];
  coachComment?: string;
  currentBelt?: string;
}

// Group interface
export interface Group {
  id: string;
  name: string;
  ageRange: string;
  level: string;
  capacity: number;
  description?: string;
  coachId?: string;
  locationId?: string;
  coach?: User;
  location?: Location;
}

// Location interface
export interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  district?: string;
  lat?: number;
  lng?: number;
  description?: string;
}

// Schedule interface
export interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  groupId?: string;
  group?: Group;
  coach?: User;
  location?: Location;
}

// Attendance stats
export interface AttendanceStats {
  monthTotal: number;
  present: number;
  warned: number;
  absent: number;
  percent: number;
}

// Monthly goal
export interface MonthlyGoal {
  target: number;
  current: number;
}

// Achievement
export interface Achievement {
  id: string;
  title: string;
  description: string;
  type: string;
  awardedAt: string;
}

// Subscription interface (NEW)
export interface Subscription {
  id: string;
  childId: string;
  parentId: string;
  planName: string;
  price: number;
  currency: string;
  billingCycle: string;
  dueDay: number;
  startDate: string;
  endDate?: string;
  status: SubscriptionStatus;
  lastBilledAt?: string;
  nextBillingAt?: string;
  createdAt: string;
  child?: Child;
}

// Invoice interface (NEW)
export interface Invoice {
  id: string;
  childId: string;
  parentId: string;
  subscriptionId?: string;
  amount: number;
  currency: string;
  description: string;
  status: InvoiceStatus;
  dueDate: string;
  paidAt?: string;
  proofUrl?: string;
  adminNote?: string;
  createdAt: string;
  child?: Child;
}

// Payment interface (legacy, maps to Invoice)
export interface Payment {
  id: string;
  childId: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentStatus | InvoiceStatus;
  dueDate?: string;
  paidAt?: string;
  proofUrl?: string;
  child?: Child;
}

// Feed post interface
export interface FeedPost {
  id: string;
  title: string;
  body?: string;
  type: FeedPostType;
  visibility: FeedVisibility;
  mediaUrl?: string;
  isPinned: boolean;
  publishedAt: string;
  author?: User;
  groupId?: string;
}

// Notification interface
export interface Notification {
  id: string;
  type: NotificationType | string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

// Parent dashboard response
export interface ParentDashboard {
  user: User;
  children: Child[];
  nextTraining?: Schedule;
  pendingPayments: Invoice[];
  feedPreview: FeedPost[];
  unreadMessages: number;
  notificationsUnread: number;
  billing: {
    pending: number;
    overdue: number;
  };
  stateFlags: {
    hasChildren: boolean;
    hasAssignedGroups: boolean;
    hasUpcomingTraining: boolean;
    hasPendingPayments: boolean;
    hasUnreadMessages: boolean;
  };
}

// Billing stats for admin
export interface BillingStats {
  revenue: {
    paid: number;
    pending: number;
    overdue: number;
  };
  alerts: {
    overdue_3_days: number;
    overdue_7_days: number;
  };
  counts: {
    paid: number;
    pending: number;
    overdue: number;
  };
}

// Auth responses
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  expiresIn: number;
}
