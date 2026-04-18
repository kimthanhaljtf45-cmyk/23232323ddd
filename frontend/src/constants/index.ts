import Constants from 'expo-constants';
import { Platform } from 'react-native';

// HARDCODED BACKEND URL - guaranteed to work
const HARDCODED_BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

// API Configuration
const getApiUrl = () => {
  // Always use EXPO_PUBLIC_BACKEND_URL if available
  if (HARDCODED_BACKEND) {
    console.log('[API_URL] Using EXPO_PUBLIC_BACKEND_URL:', HARDCODED_BACKEND);
    return HARDCODED_BACKEND;
  }
  
  // For native - try expo config
  const expoBackendUrl = Constants.expoConfig?.extra?.BACKEND_URL;
  if (expoBackendUrl) {
    console.log('[API_URL] Using expoConfig.extra.BACKEND_URL:', expoBackendUrl);
    return expoBackendUrl;
  }
  
  // Fallback to current origin for web (local development)
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const origin = window.location.origin;
    console.log('[API_URL] Fallback to origin:', origin);
    return origin;
  }
  
  console.error('[API_URL] No backend URL configured!');
  return '';
};

export const API_URL = getApiUrl();

// Auth
export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_REFRESH_KEY = 'refresh_token';
export const AUTH_USER_KEY = 'auth_user';

// OTP
export const OTP_LENGTH = 6;
export const OTP_RESEND_DELAY = 60; // seconds
export const OTP_EXPIRY = 300; // seconds

// Pagination
export const DEFAULT_PAGE_SIZE = 20;

// Date formats
export const DATE_FORMAT = 'dd.MM.yyyy';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'dd.MM.yyyy HH:mm';

// Ukrainian weekday names
export const WEEKDAYS_UA = [
  'Неділя',
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  "\u041f'ятниця",
  'Субота',
];

export const WEEKDAYS_SHORT_UA = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// Ukrainian month names
export const MONTHS_UA = [
  'січень',
  'лютий',
  'березень',
  'квітень',
  'травень',
  'червень',
  'липень',
  'серпень',
  'вересень',
  'жовтень',
  'листопад',
  'грудень',
];

// Role labels
export const ROLE_LABELS: Record<string, string> = {
  PARENT: 'Батько',
  STUDENT: 'Учень',
  COACH: 'Тренер',
  ADMIN: 'Адміністратор',
  GUEST: 'Гість',
};

// Payment status labels
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Очікує оплати',
  UNDER_REVIEW: 'На перевірці',
  PAID: 'Оплачено',
  REJECTED: 'Відхилено',
  OVERDUE: 'Прострочено',
};

// Attendance status labels
export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Був',
  ABSENT: 'Пропустив',
  WARNED: 'Попередив',
  LATE: 'Запізнився',
  CANCELLED: 'Скасовано',
};
