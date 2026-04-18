import { AttendanceStatus } from '../../../services/api/attendance';

export function getStatusLabel(status: AttendanceStatus) {
  switch (status) {
    case 'PRESENT':
      return 'Був';
    case 'ABSENT':
      return 'Не був';
    case 'WARNED':
      return 'Попередив';
    case 'LATE':
      return 'Запізнився';
    default:
      return 'Не відмічено';
  }
}

export function getStatusColors(status: AttendanceStatus) {
  switch (status) {
    case 'PRESENT':
      return {
        bg: '#DCFCE7',
        text: '#166534',
        border: '#22C55E',
      };
    case 'ABSENT':
      return {
        bg: '#FEE2E2',
        text: '#991B1B',
        border: '#EF4444',
      };
    case 'WARNED':
      return {
        bg: '#FEF3C7',
        text: '#92400E',
        border: '#F59E0B',
      };
    case 'LATE':
      return {
        bg: '#DBEAFE',
        text: '#1D4ED8',
        border: '#3B82F6',
      };
    default:
      return {
        bg: '#F3F4F6',
        text: '#6B7280',
        border: '#D1D5DB',
      };
  }
}
