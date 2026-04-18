import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Alert {
  type: string;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface Recommendation {
  type: string;
  title: string;
  action?: string;
}

export interface ChildInsight {
  childId: string;
  name: string;
  status: 'good' | 'warning' | 'critical';
  discipline: number;
  attendance: number;
  progressPercent: number;
  belt: string;
  alerts: Alert[];
  recommendations: Recommendation[];
  monthlyGoal: { target: number; current: number };
  lastCoachComment?: string;
  recentAchievements: any[];
}

export interface ParentInsightsData {
  children: ChildInsight[];
}

export function useParentInsights() {
  return useQuery<ParentInsightsData>({
    queryKey: ['parent-insights'],
    queryFn: async () => {
      const response = await api.getParentInsights();
      return response;
    },
    staleTime: 30000, // 30 seconds
  });
}
