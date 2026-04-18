import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_URL, AUTH_TOKEN_KEY, AUTH_REFRESH_KEY } from '@/constants';
import type { AuthResponse, User, ParentDashboard, Child, Schedule, Payment, FeedPost, Invoice, Subscription, BillingStats } from '@/types';

// Storage helper that works on both web and native
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(key);
        console.log(`[Storage] getItem(${key}):`, value ? value.substring(0, 30) + '...' : 'null');
        return value;
      }
      const value = await AsyncStorage.getItem(key);
      console.log(`[Storage] getItem(${key}):`, value ? value.substring(0, 30) + '...' : 'null');
      return value;
    } catch (e) {
      console.log(`[Storage] getItem error:`, e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      console.log(`[Storage] setItem(${key}):`, value.substring(0, 30) + '...');
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        console.log(`[Storage] setItem success (web)`);
      } else {
        await AsyncStorage.setItem(key, value);
        console.log(`[Storage] setItem success (native)`);
      }
    } catch (e) {
      console.log(`[Storage] setItem error:`, e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  },
};

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;
  private _saasListeners: Array<(event: string, data: any) => void> = [];

  onSaasEvent(listener: (event: string, data: any) => void) {
    this._saasListeners.push(listener);
    return () => {
      this._saasListeners = this._saasListeners.filter(l => l !== listener);
    };
  }

  _emitSaasEvent(event: string, data: any) {
    this._saasListeners.forEach(l => l(event, data));
  }

  constructor() {
    this.client = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config;
        const responseData = error.response?.data as any;

        // SaaS enforcement: emit events for modals
        if (error.response?.status === 403 && responseData?.upgrade_required) {
          console.log('[SaaS] Limit exceeded:', responseData);
          this._emitSaasEvent('limit_exceeded', responseData);
        }
        if (error.response?.status === 402 && responseData?.payment_required) {
          console.log('[SaaS] Payment required:', responseData);
          this._emitSaasEvent('payment_required', responseData);
        }

        if (error.response?.status === 401 && originalRequest) {
          // Try refresh
          const newToken = await this.refreshToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  private async getToken(): Promise<string | null> {
    const token = await storage.getItem(AUTH_TOKEN_KEY);
    console.log('[API] getToken:', token ? `${token.substring(0, 20)}...` : 'null');
    return token;
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await storage.getItem(AUTH_REFRESH_KEY);
        if (!refreshToken) return null;

        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken, refreshToken: newRefresh } = response.data;
        await storage.setItem(AUTH_TOKEN_KEY, accessToken);
        await storage.setItem(AUTH_REFRESH_KEY, newRefresh);
        return accessToken;
      } catch {
        await storage.removeItem(AUTH_TOKEN_KEY);
        await storage.removeItem(AUTH_REFRESH_KEY);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  // ==================== AUTH ====================
  
  async requestOtp(phone: string): Promise<{ success: boolean; message: string; expiresIn: number }> {
    console.log('[API] requestOtp called with phone:', phone);
    console.log('[API] baseURL:', this.client.defaults.baseURL);
    try {
      const response = await this.client.post('/auth/request-otp', { phone });
      console.log('[API] requestOtp success:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('[API] requestOtp FAILED:', error.message);
      console.error('[API] requestOtp error details:', error.response?.data || error.code || 'No details');
      throw error;
    }
  }

  async verifyOtp(phone: string, code: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/verify-otp', { phone, code });
    const data = response.data;
    
    console.log('[API] verifyOtp response - saving tokens');
    await storage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    console.log('[API] Token saved:', data.accessToken.substring(0, 30) + '...');
    
    if (data.refreshToken) {
      await storage.setItem(AUTH_REFRESH_KEY, data.refreshToken);
    }
    
    // Verify token was saved
    const savedToken = await storage.getItem(AUTH_TOKEN_KEY);
    console.log('[API] Verified saved token:', savedToken ? savedToken.substring(0, 30) + '...' : 'NULL!');
    
    return data;
  }

  async register(phone: string, code: string, userData: { firstName: string; lastName?: string; role: string }): Promise<AuthResponse> {
    const response = await this.client.post('/auth/register', { phone, code, ...userData });
    const data = response.data;
    
    await storage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      await storage.setItem(AUTH_REFRESH_KEY, data.refreshToken);
    }
    
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch {
      // Ignore logout errors
    }
    await storage.removeItem(AUTH_TOKEN_KEY);
    await storage.removeItem(AUTH_REFRESH_KEY);
  }

  async getMe(): Promise<User> {
    const response = await this.client.get('/users/me');
    return response.data;
  }

  // Mock auth for development
  async mockLogin(telegramId: string, firstName: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/mock', { telegramId, firstName });
    const data = response.data;
    
    await storage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    
    return data;
  }

  // Google Auth
  async googleAuth(idToken: string, referralCode?: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/google', { idToken, referralCode });
    const data = response.data;
    
    await storage.setItem(AUTH_TOKEN_KEY, data.accessToken);
    if (data.refreshToken) {
      await storage.setItem(AUTH_REFRESH_KEY, data.refreshToken);
    }
    
    return data;
  }

  // ==================== DISCOUNTS ====================

  async calculateDiscounts(data: { baseAmount: number; childId?: string; context?: string; promoCode?: string }): Promise<any> {
    const response = await this.client.post('/discounts/calculate', data);
    return response.data;
  }

  async validatePromoCode(promoCode: string): Promise<{ valid: boolean; message?: string }> {
    const response = await this.client.post('/discounts/validate-promo', { promoCode });
    return response.data;
  }

  // ==================== REFERRALS ====================

  async validateReferralCode(code: string): Promise<{ valid: boolean; message?: string }> {
    const response = await this.client.post('/referrals/validate', { code });
    return response.data;
  }

  // ==================== META BRAIN ====================

  async getMetaParent(): Promise<any> {
    const response = await this.client.get('/meta/parent');
    return response.data;
  }

  async getMetaCoach(): Promise<any> {
    const response = await this.client.get('/meta/coach');
    return response.data;
  }

  async getMetaAdmin(): Promise<any> {
    const response = await this.client.get('/meta/admin');
    return response.data;
  }

  // Generic POST method
  async post(url: string, data?: any): Promise<any> {
    const response = await this.client.post(url, data);
    return response.data;
  }

  // ==================== PARENT DASHBOARD ====================

  async getParentDashboard(): Promise<ParentDashboard> {
    const response = await this.client.get('/users/me/dashboard');
    return response.data;
  }

  // ==================== CHILDREN ====================

  async getChildren(): Promise<Child[]> {
    const response = await this.client.get('/children');
    return response.data;
  }

  async getChild(childId: string): Promise<Child> {
    const response = await this.client.get(`/children/${childId}`);
    return response.data;
  }

  async createChild(data: { firstName: string; lastName?: string; birthDate?: string; groupId?: string }): Promise<Child> {
    const response = await this.client.post('/children', data);
    return response.data;
  }

  async updateChild(childId: string, data: Partial<Child>): Promise<void> {
    await this.client.patch(`/children/${childId}`, data);
  }

  // ==================== SUBSCRIPTIONS (NEW) ====================

  async getSubscriptions(): Promise<Subscription[]> {
    const response = await this.client.get('/billing/subscriptions');
    return response.data;
  }

  async getSubscription(subscriptionId: string): Promise<Subscription> {
    const response = await this.client.get(`/billing/subscriptions/${subscriptionId}`);
    return response.data;
  }

  async createSubscription(data: { childId: string; planName?: string; price?: number; dueDay?: number }): Promise<Subscription> {
    const response = await this.client.post('/billing/subscriptions', data);
    return response.data;
  }

  async updateSubscription(subscriptionId: string, data: { status?: string; price?: number }): Promise<Subscription> {
    const response = await this.client.patch(`/billing/subscriptions/${subscriptionId}`, data);
    return response.data;
  }

  // ==================== INVOICES (NEW) ====================

  async getInvoices(status?: string): Promise<Invoice[]> {
    const params = status ? { status } : {};
    const response = await this.client.get('/billing/invoices', { params });
    return response.data;
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const response = await this.client.get(`/billing/invoices/${invoiceId}`);
    return response.data;
  }

  async uploadPaymentProof(invoiceId: string, proofUrl: string): Promise<void> {
    await this.client.post(`/billing/invoices/${invoiceId}/upload-proof`, { proofUrl });
  }

  async createInvoice(data: { childId: string; amount: number; description?: string; dueDate: string }): Promise<Invoice> {
    const response = await this.client.post('/billing/invoices', data);
    return response.data;
  }

  // Admin invoice actions
  async approveInvoice(invoiceId: string, adminNote?: string): Promise<void> {
    await this.client.post(`/billing/invoices/${invoiceId}/approve`, { adminNote });
  }

  async rejectInvoice(invoiceId: string, adminNote?: string): Promise<void> {
    await this.client.post(`/billing/invoices/${invoiceId}/reject`, { adminNote });
  }

  async getPendingReviewInvoices(): Promise<Invoice[]> {
    const response = await this.client.get('/billing/pending-review');
    return response.data;
  }

  // ==================== BILLING STATS (ADMIN) ====================

  async getBillingStats(): Promise<BillingStats> {
    const response = await this.client.get('/billing/stats');
    return response.data;
  }

  async runBillingCheck(): Promise<{ success: boolean; invoicesGenerated: number }> {
    const response = await this.client.post('/billing/run-check');
    return response.data;
  }

  // ==================== SCHEDULE ====================

  async getSchedule(groupId?: string): Promise<Schedule[]> {
    const params = groupId ? { groupId } : {};
    const response = await this.client.get('/schedule', { params });
    return response.data;
  }

  // ==================== ATTENDANCE ====================

  async getChildAttendance(childId: string): Promise<any[]> {
    const response = await this.client.get(`/attendance/child/${childId}`);
    return response.data;
  }

  async reportAbsence(data: { childId: string; scheduleId: string; date: string; reason: string; comment?: string }): Promise<any> {
    const response = await this.client.post('/attendance/report-absence', data);
    return response.data;
  }

  async getUpcomingTrainings(childId: string): Promise<any[]> {
    const response = await this.client.get(`/attendance/upcoming/${childId}`);
    return response.data;
  }

  // ==================== MESSAGING ====================

  async getMessagesInbox(): Promise<any[]> {
    const response = await this.client.get('/messages/inbox');
    return response.data;
  }

  async getThread(threadId: string): Promise<{ thread: any; messages: any[] }> {
    const response = await this.client.get(`/messages/thread/${threadId}`);
    return response.data;
  }

  async sendMessage(threadId: string, text: string): Promise<any> {
    const response = await this.client.post(`/messages/thread/${threadId}/send`, { text });
    return response.data;
  }

  async startThread(coachId: string, message: string): Promise<{ threadId: string }> {
    const response = await this.client.post('/messages/start', { coachId, message });
    return response.data;
  }

  async getUnreadCount(): Promise<{ count: number }> {
    const response = await this.client.get('/messages/unread-count');
    return response.data;
  }

  // ==================== PAYMENTS (LEGACY - redirects to invoices) ====================

  async getPayments(): Promise<Payment[]> {
    const response = await this.client.get('/payments');
    return response.data;
  }

  async getPayment(paymentId: string): Promise<Payment> {
    const response = await this.client.get(`/payments/${paymentId}`);
    return response.data;
  }

  async confirmPayment(paymentId: string, proofUrl?: string): Promise<void> {
    await this.client.post(`/payments/${paymentId}/confirm`, { proofUrl });
  }

  // ==================== FEED ====================

  async getFeed(filter?: string): Promise<FeedPost[]> {
    const params = filter && filter !== 'all' ? { filter } : {};
    const response = await this.client.get('/content/feed', { params });
    return response.data;
  }

  // ==================== GROUPS & LOCATIONS ====================

  async getGroups(): Promise<any[]> {
    const response = await this.client.get('/groups');
    return response.data;
  }

  async getLocations(): Promise<any[]> {
    const response = await this.client.get('/locations');
    return response.data;
  }

  // ==================== NOTIFICATIONS ====================

  async getNotifications(limit?: number): Promise<any[]> {
    const params = limit ? { limit: limit.toString() } : {};
    const response = await this.client.get('/notifications', { params });
    return response.data;
  }

  async getNotificationUnreadCount(): Promise<{ count: number }> {
    const response = await this.client.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationAsRead(notificationId: string): Promise<{ success: boolean }> {
    const response = await this.client.post('/notifications/read', { notificationId });
    return response.data;
  }

  async markAllNotificationsAsRead(): Promise<{ count: number }> {
    const response = await this.client.post('/notifications/read-all');
    return response.data;
  }

  // ==================== PARENT INSIGHTS ====================

  async getParentInsights(): Promise<any> {
    const response = await this.client.get('/parent/insights');
    return response.data;
  }

  // ==================== DEVICES ====================

  async registerDevice(token: string, platform: 'ios' | 'android' | 'web'): Promise<{ success: boolean }> {
    const response = await this.client.post('/devices/register', { token, platform });
    return response.data;
  }

  async unregisterDevice(token: string): Promise<{ success: boolean }> {
    const response = await this.client.post('/devices/unregister', { token });
    return response.data;
  }

  // ==================== RAW METHODS ====================

  async get(path: string, config?: any): Promise<any> {
    const response = await this.client.get(path, config);
    return response.data;
  }

  async post(path: string, data?: any, config?: any): Promise<any> {
    const response = await this.client.post(path, data, config);
    return response.data;
  }

  async put(path: string, data?: any, config?: any): Promise<any> {
    const response = await this.client.put(path, data, config);
    return response.data;
  }

  async patch(path: string, data?: any, config?: any): Promise<any> {
    const response = await this.client.patch(path, data, config);
    return response.data;
  }

  async delete(path: string, config?: any): Promise<any> {
    const response = await this.client.delete(path, config);
    return response.data;
  }

  // ==================== HEALTH ====================

  async healthCheck(): Promise<{ status: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // ==================== ALERTS ====================

  async getMyAlerts(includeResolved = false): Promise<any[]> {
    const response = await this.client.get('/alerts', {
      params: { includeResolved: includeResolved ? 'true' : 'false' },
    });
    return response.data;
  }

  async getAlertsSummary(): Promise<{ total: number; critical: number; warning: number; info: number }> {
    const response = await this.client.get('/alerts/summary');
    return response.data;
  }

  async getCriticalAlerts(): Promise<any[]> {
    const response = await this.client.get('/alerts/critical');
    return response.data;
  }

  async getChildAlerts(childId: string, includeResolved = false): Promise<any[]> {
    const response = await this.client.get(`/alerts/child/${childId}`, {
      params: { includeResolved: includeResolved ? 'true' : 'false' },
    });
    return response.data;
  }

  async resolveAlert(alertId: string): Promise<any> {
    const response = await this.client.post(`/alerts/${alertId}/resolve`);
    return response.data;
  }

  async runAlertsEngine(): Promise<{ alertsCreated: number }> {
    const response = await this.client.post('/alerts/run');
    return response.data;
  }

  // ==================== COACH ACTIONS ====================

  async getCoachActions(): Promise<{
    summary: { total: number; critical: number; warning: number; info: number };
    items: any[];
  }> {
    const response = await this.client.get('/coach/actions');
    return response.data;
  }

  async completeCoachAction(actionId: string): Promise<any> {
    const response = await this.client.post(`/coach/actions/${actionId}/complete`);
    return response.data;
  }

  async snoozeCoachAction(actionId: string, until?: string): Promise<any> {
    const response = await this.client.post(`/coach/actions/${actionId}/snooze`, { until });
    return response.data;
  }

  async syncCoachActions(): Promise<{ actionsCreated: number }> {
    const response = await this.client.post('/coach/actions/sync');
    return response.data;
  }

  // ==================== RETENTION ====================

  async getChildRetention(childId: string): Promise<{
    childId: string;
    streak: number;
    monthlyGoal: { target: number; current: number; percent: number };
    engagementStatus: string;
    dropOffRisk: string;
    nextMilestone?: { type: string; title: string; progress?: number };
    recentAchievements: any[];
    recommendations: any[];
    attendanceRate: number;
    daysSinceLastVisit?: number;
  }> {
    const response = await this.client.get(`/retention/child/${childId}`);
    return response.data;
  }

  async getParentRetention(): Promise<any> {
    const response = await this.client.get('/retention/parent');
    return response.data;
  }

  async getMyRetention(): Promise<any> {
    const response = await this.client.get('/retention/student/me');
    return response.data;
  }

  async getCoachRisks(): Promise<{
    total: number;
    critical: number;
    warning: number;
    items: any[];
  }> {
    const response = await this.client.get('/retention/coach/risks');
    return response.data;
  }

  async getRetentionStats(): Promise<{
    totalActive: number;
    goodEngagement: number;
    warningEngagement: number;
    criticalEngagement: number;
    averageStreak: number;
    averageAttendance: number;
  }> {
    const response = await this.client.get('/retention/stats');
    return response.data;
  }

  async recalculateRetention(): Promise<{ processed: number }> {
    const response = await this.client.post('/retention/recalculate');
    return response.data;
  }

  async recalculateChildRetention(childId: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/retention/recalculate/child/${childId}`);
    return response.data;
  }

  // =====================
  // CONSULTATION (Lead Capture)
  // =====================

  async createConsultation(data: {
    fullName: string;
    phone: string;
    role?: string;
    programType?: string;
    childAge?: string;
    source?: string;
  }): Promise<{ id: string; message: string }> {
    const response = await this.client.post('/consultations', data);
    return response.data;
  }

  // =====================
  // META-BRAIN / AI Insights
  // =====================

  async getCoachInsights(): Promise<{
    totalStudents: number;
    criticalCount: number;
    warningCount: number;
    goodCount: number;
    topRisks: any[];
    recommendedActions: any[];
    recommendations: string[];
  }> {
    const response = await this.client.get('/meta/coach');
    return response.data;
  }

  async getAdminInsights(): Promise<{
    summary: {
      totalStudents: number;
      totalParents: number;
      totalCoaches: number;
      criticalRisks: number;
      warningRisks: number;
      healthyStudents: number;
    };
    revenue: {
      total: number;
      pending: number;
      overdue: number;
      atRisk: number;
    };
    predictions: {
      churnProbability: number;
      churnCount: number;
      expectedRevenueLoss: number;
    };
    topRisks: any[];
  }> {
    const response = await this.client.get('/meta/admin');
    return response.data;
  }

  async getChildAnalysis(childId: string): Promise<{
    risk: number;
    status: string;
    name: string;
    actions: any[];
    factors: any[];
  }> {
    const response = await this.client.get(`/meta/child/${childId}`);
    return response.data;
  }

  // =====================
  // GROWTH ANALYTICS
  // =====================

  async getGrowthOverview(): Promise<{
    offers: {
      total: number;
      active: number;
      totalViews: number;
      totalConversions: number;
      overallConversionRate: string;
    };
    funnel: {
      active: number;
      warning: number;
      churnRisk: number;
      offersShown: number;
      returned: number;
      paid: number;
    };
    efficiency: {
      totalDiscountGiven: number;
      revenueRecovered: number;
      net: number;
      savedUsers: number;
    };
    referrals: {
      codesIssued: number;
      codesActivated: number;
      registrations: number;
      paidConversions: number;
      revenueFromReferrals: number;
    };
    kpi: {
      savedRevenue: number;
      netRecovery: number;
      savedUsers: number;
      referralRevenue: number;
    };
  }> {
    const response = await this.client.get('/growth/overview');
    return response.data;
  }

  async getRetentionFunnel(): Promise<{
    active: number;
    warning: number;
    churnRisk: number;
    offersShown: number;
    returned: number;
    paid: number;
    conversionRate: number;
  }> {
    const response = await this.client.get('/growth/retention-funnel');
    return response.data;
  }

  async getDiscountEfficiency(): Promise<{
    totalDiscountGiven: number;
    revenueRecovered: number;
    net: number;
    savedUsers: number;
    avgDiscountPercent: number;
  }> {
    const response = await this.client.get('/growth/discount-efficiency');
    return response.data;
  }

  async getProgramAnalytics(): Promise<Array<{
    program: string;
    activeStudents: number;
    churnRate: number;
    arpu: number;
    avgAttendance: number;
  }>> {
    const response = await this.client.get('/growth/programs');
    return response.data;
  }

  async getCoachPerformance(): Promise<Array<{
    coachId: string;
    name: string;
    studentsCount: number;
    attendanceCompletion: number;
    recoveryRate: number;
    savedUsers: number;
    personalBookingRevenue: number;
    competitionResults: { gold: number; silver: number; bronze: number };
  }>> {
    const response = await this.client.get('/growth/coaches');
    return response.data;
  }

  async getPredictiveAdminStats(): Promise<{
    churn7dCount: number;
    paymentRiskCount: number;
    upsellCandidates: number;
    avgChurn7d: number;
    avgPaymentRisk: number;
  }> {
    const response = await this.client.get('/predictive/admin');
    return response.data;
  }

  // =====================
  // COACH ACTIONS
  // =====================

  async getCoachActions(): Promise<{
    actions: any[];
    groupedByPriority: any;
  }> {
    const response = await this.client.get('/coach/actions');
    return response.data;
  }

  async markCoachActionComplete(actionId: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/coach/actions/${actionId}/complete`);
    return response.data;
  }

  // Onboarding API
  async selectOnboardingProgram(programType: string): Promise<{ success: boolean; programType: string }> {
    const response = await this.client.post('/onboarding/select-program', { programType });
    return response.data;
  }

  async submitOnboarding(data: {
    childName?: string;
    age?: number;
    goal?: string;
    district?: string;
    preferredSchedule?: string[];
    specialNotes?: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/onboarding/submit', data);
    return response.data;
  }

  async getOnboardingRecommendation(): Promise<{
    programType: string;
    recommendedGroup: any;
    actions: Array<{ type: string; title: string }>;
    message: string;
  }> {
    const response = await this.client.get('/onboarding/recommendation');
    return response.data;
  }

  // Update user role
  async updateUserRole(role: string): Promise<User> {
    const response = await this.client.patch('/users/me', { role });
    return response.data;
  }

  // ==================== COMPETITIONS API ====================
  
  // Get all competitions
  async getCompetitions(params?: { status?: string; programType?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.programType) query.append('programType', params.programType);
    const queryStr = query.toString() ? `?${query.toString()}` : '';
    const response = await this.client.get(`/competitions${queryStr}`);
    return response.data;
  }

  // Get competition by ID
  async getCompetition(id: string): Promise<any> {
    const response = await this.client.get(`/competitions/${id}`);
    return response.data;
  }

  // Get upcoming competitions
  async getUpcomingCompetitions(limit: number = 5): Promise<any[]> {
    const response = await this.client.get(`/competitions/upcoming?limit=${limit}`);
    return response.data;
  }

  // Get champions
  async getChampions(limit: number = 20): Promise<any[]> {
    const response = await this.client.get(`/competitions/champions?limit=${limit}`);
    return response.data;
  }

  // Get competition stats
  async getCompetitionStats(): Promise<any> {
    const response = await this.client.get('/competitions/stats');
    return response.data;
  }

  // Get my competitions (for parents/students)
  async getMyCompetitions(): Promise<any[]> {
    const response = await this.client.get('/competitions/my/list');
    return response.data;
  }

  // Join competition
  async joinCompetition(competitionId: string, data: { childId: string; category?: string }): Promise<any> {
    const response = await this.client.post(`/competitions/${competitionId}/join`, data);
    return response.data;
  }

  // ADMIN: Create competition
  async createCompetition(data: {
    title: string;
    description?: string;
    date: string;
    location: string;
    programType: string;
    registrationDeadline: string;
    hasFee: boolean;
    feeAmount?: number;
  }): Promise<any> {
    const response = await this.client.post('/admin/competitions', data);
    return response.data;
  }

  // ADMIN: Update competition
  async updateCompetition(id: string, data: Partial<{
    title: string;
    description: string;
    date: string;
    location: string;
    programType: string;
    registrationDeadline: string;
    hasFee: boolean;
    feeAmount: number;
    status: string;
  }>): Promise<any> {
    const response = await this.client.patch(`/admin/competitions/${id}`, data);
    return response.data;
  }

  // ADMIN: Update participant status
  async updateParticipantStatus(competitionId: string, data: {
    participantId: string;
    status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
    note?: string;
  }): Promise<any> {
    const response = await this.client.post(`/admin/competitions/${competitionId}/participant-status`, data);
    return response.data;
  }

  // ADMIN: Mark participant as paid
  async markParticipantPaid(participantId: string): Promise<any> {
    const response = await this.client.post(`/admin/competitions/participants/${participantId}/mark-paid`);
    return response.data;
  }

  // ADMIN: Add competition result
  async addCompetitionResult(competitionId: string, data: {
    childId: string;
    medal: 'GOLD' | 'SILVER' | 'BRONZE' | 'PARTICIPATION';
    place: number;
    awardType?: string;
    note?: string;
  }): Promise<any> {
    const response = await this.client.post(`/admin/competitions/${competitionId}/result`, data);
    return response.data;
  }

  // ADMIN: Get detailed competition stats (KPI)
  async getCompetitionDetailedStats(competitionId: string): Promise<{
    competitionId: string;
    competitionTitle: string;
    date: string;
    status: string;
    hasFee: boolean;
    feeAmount: number;
    participants: {
      total: number;
      confirmed: number;
      pending: number;
      rejected: number;
      paid: number;
      unpaid: number;
    };
    revenue: {
      collected: number;
      potential: number;
      missed: number;
      currency: string;
    };
    conversion: {
      confirmationRate: number;
      paymentRate: number;
    };
    results: {
      total: number;
      gold: number;
      silver: number;
      bronze: number;
      participation: number;
    };
  }> {
    const response = await this.client.get(`/admin/competitions/${competitionId}/stats`);
    return response.data;
  }

  // COACH: Get today's competitions
  async getCoachTodayCompetitions(): Promise<{
    date: string;
    participants: Array<{
      participantId: string;
      childId: string;
      childName: string;
      childBelt: string;
      competitionId: string;
      competitionTitle: string;
      status: 'PENDING' | 'CONFIRMED' | 'REJECTED';
      paid: boolean;
      category?: string;
      hasFee: boolean;
      feeAmount: number;
      result: null | {
        medal: string;
        place: number;
        awardType?: string;
      };
    }>;
    summary: {
      total: number;
      confirmed: number;
      pending: number;
      paid: number;
      unpaid: number;
    };
  }> {
    const response = await this.client.get('/coach/competitions/today');
    return response.data;
  }
}

export const api = new ApiClient();
