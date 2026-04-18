import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { User, Child, Schedule, Payment, FeedPost, AuthState, Invoice, Subscription } from '@/types';
import { api } from '@/lib/api';

// Simple storage helpers
const storage = {
  get: async <T>(key: string): Promise<T | null> => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      }
      const item = await AsyncStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch {
      return null;
    }
  },
  set: async <T>(key: string, value: T): Promise<void> => {
    try {
      const json = JSON.stringify(value);
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.setItem(key, json);
      } else {
        await AsyncStorage.setItem(key, json);
      }
    } catch {
      // Ignore
    }
  },
  remove: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  },
};

const STORE_KEY = 'ataka-store-v2';

interface AppState {
  // Auth
  authState: AuthState;
  user: User | null;
  pendingPhone: string | null;
  
  // Data
  children: Child[];
  schedule: Schedule[];
  payments: Payment[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  feed: FeedPost[];
  
  // Shop
  cartItemsCount: number;
  
  // Billing
  billingStats: {
    pending: number;
    overdue: number;
  };
  
  // UI
  isLoading: boolean;
  error: string | null;
  
  // Actions - Auth
  requestOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (code: string) => Promise<boolean>;
  register: (firstName: string, lastName: string | undefined, role: string) => Promise<boolean>;
  mockLogin: (telegramId: string, firstName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  
  // Actions - Data
  fetchDashboard: () => Promise<void>;
  fetchChildren: () => Promise<void>;
  fetchChild: (childId: string) => Promise<Child | null>;
  fetchSchedule: (groupId?: string) => Promise<void>;
  fetchPayments: () => Promise<void>;
  fetchInvoices: () => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchFeed: (filter?: string) => Promise<void>;
  
  // Actions - Shop
  setCartItemsCount: (count: number) => void;
  
  // Actions - Billing
  uploadPaymentProof: (invoiceId: string, proofUrl: string) => Promise<boolean>;
  
  // Actions - Mutations
  reportAbsence: (childId: string, scheduleId: string, date: string, reason: string) => Promise<boolean>;
  confirmPayment: (paymentId: string, proofUrl?: string) => Promise<boolean>;
  
  // Helpers
  setError: (error: string | null) => void;
  clearError: () => void;
  setUser: (user: User) => void;
  _hydrate: () => Promise<void>;
}

export const useStore = create<AppState>()((set, get) => ({
  // Initial state
  authState: 'idle',
  user: null,
  pendingPhone: null,
  children: [],
  schedule: [],
  payments: [],
  invoices: [],
  subscriptions: [],
  feed: [],
  cartItemsCount: 0,
  billingStats: { pending: 0, overdue: 0 },
  isLoading: false,
  error: null,

  // Hydrate from storage
  _hydrate: async () => {
    try {
      const saved = await storage.get<{ user: User | null; authState: AuthState }>(STORE_KEY);
      if (saved && saved.user) {
        set({ user: saved.user, authState: 'authenticated' });
      }
    } catch {
      // Ignore
    }
  },

  // Shop Actions
  setCartItemsCount: (count: number) => set({ cartItemsCount: count }),

  // Auth Actions
  requestOtp: async (phone: string) => {
    try {
      set({ isLoading: true, error: null });
      await api.requestOtp(phone);
      set({ authState: 'pending_otp', pendingPhone: phone, isLoading: false });
      return true;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Помилка відправки коду', 
        isLoading: false 
      });
      return false;
    }
  },

  verifyOtp: async (code: string) => {
    const { pendingPhone } = get();
    if (!pendingPhone) return false;
    
    try {
      set({ isLoading: true, error: null });
      const response = await api.verifyOtp(pendingPhone, code);
      
      if (response.user.role) {
        set({ 
          user: response.user, 
          authState: 'authenticated',
          pendingPhone: null,
          isLoading: false 
        });
        await storage.set(STORE_KEY, { user: response.user, authState: 'authenticated' });
        return true;
      } else {
        set({ authState: 'pending_otp', isLoading: false });
        return true;
      }
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Невірний код', 
        isLoading: false 
      });
      return false;
    }
  },

  register: async (firstName: string, lastName: string | undefined, role: string) => {
    const { pendingPhone } = get();
    if (!pendingPhone) return false;
    
    try {
      set({ isLoading: true, error: null });
      const response = await api.register(pendingPhone, '', { firstName, lastName, role });
      set({ 
        user: response.user, 
        authState: 'authenticated',
        pendingPhone: null,
        isLoading: false 
      });
      await storage.set(STORE_KEY, { user: response.user, authState: 'authenticated' });
      return true;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Помилка реєстрації', 
        isLoading: false 
      });
      return false;
    }
  },

  mockLogin: async (telegramId: string, firstName: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.mockLogin(telegramId, firstName);
      set({ 
        user: response.user as User, 
        authState: 'authenticated',
        isLoading: false 
      });
      await storage.set(STORE_KEY, { user: response.user, authState: 'authenticated' });
      return true;
    } catch (error: any) {
      set({ 
        error: error.response?.data?.detail || 'Помилка входу', 
        isLoading: false 
      });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    await storage.remove(STORE_KEY);
    set({ 
      user: null, 
      authState: 'unauthenticated',
      children: [],
      schedule: [],
      payments: [],
      invoices: [],
      subscriptions: [],
      feed: [],
      billingStats: { pending: 0, overdue: 0 },
      pendingPhone: null,
    });
  },

  checkAuth: async () => {
    try {
      set({ authState: 'loading' });
      const user = await api.getMe();
      set({ user: user as User, authState: 'authenticated' });
      await storage.set(STORE_KEY, { user, authState: 'authenticated' });
    } catch {
      set({ user: null, authState: 'unauthenticated' });
    }
  },

  // Data Actions
  fetchDashboard: async () => {
    try {
      set({ isLoading: true });
      const dashboard = await api.getParentDashboard();
      set({ 
        children: dashboard.children || [],
        payments: dashboard.pendingPayments || [],
        invoices: dashboard.pendingPayments || [],
        feed: dashboard.feedPreview || [],
        billingStats: dashboard.billing || { pending: 0, overdue: 0 },
        isLoading: false 
      });
    } catch (error: any) {
      set({ error: 'Помилка завантаження даних', isLoading: false });
    }
  },

  fetchChildren: async () => {
    try {
      const children = await api.getChildren();
      set({ children });
    } catch {
      // Silent fail
    }
  },

  fetchChild: async (childId: string) => {
    try {
      const child = await api.getChild(childId);
      return child;
    } catch {
      return null;
    }
  },

  fetchSchedule: async (groupId?: string) => {
    try {
      const schedule = await api.getSchedule(groupId);
      set({ schedule });
    } catch {
      // Silent fail
    }
  },

  fetchPayments: async () => {
    try {
      const payments = await api.getPayments();
      set({ payments });
    } catch {
      // Silent fail
    }
  },

  fetchInvoices: async () => {
    try {
      const invoices = await api.getInvoices();
      set({ invoices });
    } catch {
      // Silent fail
    }
  },

  fetchSubscriptions: async () => {
    try {
      const subscriptions = await api.getSubscriptions();
      set({ subscriptions });
    } catch {
      // Silent fail
    }
  },

  fetchFeed: async (filter?: string) => {
    try {
      const feed = await api.getFeed(filter);
      set({ feed });
    } catch {
      // Silent fail
    }
  },

  // Billing Actions
  uploadPaymentProof: async (invoiceId: string, proofUrl: string) => {
    try {
      set({ isLoading: true });
      await api.uploadPaymentProof(invoiceId, proofUrl);
      await get().fetchInvoices();
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: 'Помилка завантаження підтвердження', isLoading: false });
      return false;
    }
  },

  // Mutations
  reportAbsence: async (childId, scheduleId, date, reason) => {
    try {
      set({ isLoading: true });
      await api.reportAbsence({ childId, scheduleId, date, reason });
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: 'Помилка повідомлення про пропуск', isLoading: false });
      return false;
    }
  },

  confirmPayment: async (paymentId, proofUrl) => {
    try {
      set({ isLoading: true });
      await api.confirmPayment(paymentId, proofUrl);
      await get().fetchPayments();
      set({ isLoading: false });
      return true;
    } catch (error: any) {
      set({ error: 'Помилка підтвердження оплати', isLoading: false });
      return false;
    }
  },

  // Helpers
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
  setUser: (user) => {
    set({ user, authState: 'authenticated' });
    storage.set(STORE_KEY, { user, authState: 'authenticated' });
  },
}));
