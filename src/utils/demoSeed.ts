import type { HandoverReport, UserProfile } from '../types/handover';

export const DEMO_ACCOUNTS: {
  label: string;
  email: string;
  profile: UserProfile;
}[] = [
  {
    label: 'Operator Shift 1 — Budi Santoso',
    email: 'shift1.operator@military-stability.local',
    profile: {
      id: 'demo-user-shift-1',
      email: 'shift1.operator@military-stability.local',
      fullName: 'Budi Santoso',
      role: 'operator',
      defaultShift: 'Shift 1',
      canEditAll: false,
    },
  },
  {
    label: 'Operator Shift 2 — Rina Wijaya',
    email: 'shift2.operator@military-stability.local',
    profile: {
      id: 'demo-user-shift-2',
      email: 'shift2.operator@military-stability.local',
      fullName: 'Rina Wijaya',
      role: 'operator',
      defaultShift: 'Shift 2',
      canEditAll: false,
    },
  },
  {
    label: 'Supervisor Produksi — Hendra Kusuma',
    email: 'supervisor@military-stability.local',
    profile: {
      id: 'demo-user-supervisor',
      email: 'supervisor@military-stability.local',
      fullName: 'Hendra Kusuma',
      role: 'supervisor',
      defaultShift: 'Shift 3',
      canEditAll: true,
    },
  },
];

export function createInitialDemoReports(): HandoverReport[] {
  return [];
}
