import { api } from '../../lib/api';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'WARNED' | 'LATE' | null;

export interface CoachScheduleAttendanceResponse {
  schedule: {
    id: string;
    groupName: string;
    date: string;
    time: string;
    location: string;
  };
  children: Array<{
    childId: string;
    childName: string;
    status: AttendanceStatus;
    reason?: string | null;
    comment?: string | null;
  }>;
}

export interface MarkAttendancePayload {
  childId: string;
  scheduleId: string;
  date: string;
  status: Exclude<AttendanceStatus, null>;
  comment?: string;
}

export interface TodaySchedule {
  id: string;
  groupName: string;
  time: string;
  location: string;
  childrenCount: number;
  markedCount: number;
  isComplete: boolean;
}

export interface TodaySchedulesResponse {
  schedules: TodaySchedule[];
  date: string;
}

export async function getCoachScheduleAttendance(
  scheduleId: string,
): Promise<CoachScheduleAttendanceResponse> {
  const response = await api.get(`/coach/schedule/${scheduleId}/attendance`);
  return response;
}

export async function markAttendance(
  payload: MarkAttendancePayload,
): Promise<void> {
  await api.post('/attendance/mark', payload);
}

export async function getCoachTodaySchedules(): Promise<TodaySchedulesResponse> {
  const response = await api.get('/coach/schedules/today');
  return response;
}
