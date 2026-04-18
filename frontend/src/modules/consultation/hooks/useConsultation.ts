import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getConsultationBoard, 
  getConsultationStats, 
  updateConsultationStatus,
  convertConsultation,
  assignConsultation,
} from '../api';

export function useConsultationBoard() {
  return useQuery({
    queryKey: ['consultation-board'],
    queryFn: getConsultationBoard,
    staleTime: 30 * 1000,
  });
}

export function useConsultationStats() {
  return useQuery({
    queryKey: ['consultation-stats'],
    queryFn: getConsultationStats,
    staleTime: 30 * 1000,
  });
}

export function useUpdateConsultationStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; status: string; lostReason?: string; trialDate?: string }) => 
      updateConsultationStatus(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-board'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-stats'] });
    },
  });
}

export function useConvertConsultation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; locationId?: string; groupId?: string }) => 
      convertConsultation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-board'] });
      queryClient.invalidateQueries({ queryKey: ['consultation-stats'] });
    },
  });
}

export function useAssignConsultation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; assignedToAdminId?: string; assignedCoachId?: string }) => 
      assignConsultation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-board'] });
    },
  });
}
