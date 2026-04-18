import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useStore } from '@/store/useStore';

export interface DashboardBlock {
  type: string;
  priority: number;
  items: any[];
}

export interface DashboardResponse {
  role: string;
  programType: string;
  header: {
    title: string;
    subtitle: string;
  };
  state: Record<string, any>;
  blocks: DashboardBlock[];
}

export function useDashboard() {
  const { accessToken } = useStore();

  return useQuery<DashboardResponse>({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.get('/dashboard');
      return response;
    },
    enabled: !!accessToken,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
