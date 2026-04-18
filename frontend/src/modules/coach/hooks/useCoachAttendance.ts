import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CoachScheduleAttendanceResponse,
  MarkAttendancePayload,
  getCoachScheduleAttendance,
  markAttendance,
  getCoachTodaySchedules,
  TodaySchedulesResponse,
} from '../../../services/api/attendance';

export const coachAttendanceKeys = {
  all: ['coach-attendance'] as const,
  detail: (scheduleId: string) => [...coachAttendanceKeys.all, scheduleId] as const,
  today: ['coach-schedules-today'] as const,
};

export function useCoachAttendance(scheduleId: string) {
  return useQuery({
    queryKey: coachAttendanceKeys.detail(scheduleId),
    queryFn: () => getCoachScheduleAttendance(scheduleId),
    enabled: !!scheduleId,
  });
}

export function useCoachTodaySchedules() {
  return useQuery({
    queryKey: coachAttendanceKeys.today,
    queryFn: () => getCoachTodaySchedules(),
  });
}

export function useMarkAttendance(scheduleId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MarkAttendancePayload) => markAttendance(payload),

    onMutate: async (payload) => {
      await queryClient.cancelQueries({
        queryKey: coachAttendanceKeys.detail(scheduleId),
      });

      const previous = queryClient.getQueryData<CoachScheduleAttendanceResponse>(
        coachAttendanceKeys.detail(scheduleId),
      );

      if (previous) {
        queryClient.setQueryData<CoachScheduleAttendanceResponse>(
          coachAttendanceKeys.detail(scheduleId),
          {
            ...previous,
            children: previous.children.map((child) =>
              child.childId === payload.childId
                ? {
                    ...child,
                    status: payload.status,
                    comment: payload.comment ?? null,
                  }
                : child,
            ),
          },
        );
      }

      return { previous };
    },

    onError: (_error, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          coachAttendanceKeys.detail(scheduleId),
          context.previous,
        );
      }
    },

    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: coachAttendanceKeys.detail(scheduleId),
      });
      // Also invalidate today's schedules to update counts
      await queryClient.invalidateQueries({
        queryKey: coachAttendanceKeys.today,
      });
    },
  });
}
