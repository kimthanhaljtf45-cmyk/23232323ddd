import { api } from '@/lib/api';

export interface CreateConsultationPayload {
  fullName: string;
  childName?: string;
  age?: number;
  phone: string;
  role: 'PARENT' | 'STUDENT';
  programType: 'KIDS' | 'SPECIAL' | 'ADULT_SELF_DEFENSE' | 'ADULT_PRIVATE' | 'CONSULTATION';
  district?: string;
  locationId?: string;
  preferredDays?: string[];
  experienceLevel?: string;
  goal?: string;
  notes?: string;
}

export async function createConsultation(payload: CreateConsultationPayload) {
  return api.post('/consultations', payload);
}

export async function getConsultationBoard() {
  return api.get('/admin/consultations/board');
}

export async function getConsultationStats() {
  return api.get('/admin/consultations/stats');
}

export async function getConsultationById(id: string) {
  return api.get(`/admin/consultations/${id}`);
}

export async function updateConsultationStatus(id: string, payload: {
  status: string;
  lostReason?: string;
  trialDate?: string;
  trialLocationId?: string;
}) {
  return api.patch(`/admin/consultations/${id}/status`, payload);
}

export async function assignConsultation(id: string, payload: {
  assignedToAdminId?: string;
  assignedCoachId?: string;
}) {
  return api.patch(`/admin/consultations/${id}/assign`, payload);
}

export async function convertConsultation(id: string, payload: {
  locationId?: string;
  groupId?: string;
}) {
  return api.post(`/admin/consultations/${id}/convert`, payload);
}
