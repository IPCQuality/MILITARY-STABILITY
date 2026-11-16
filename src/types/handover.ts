export const SHIFTS = ['Shift 1', 'Shift 2', 'Shift 3'] as const;
export type ShiftType = (typeof SHIFTS)[number];

export const CATEGORIES = [
  'OVERHAUL',
  'STABILITY TINGGI',
  'CASE PERBAIKAN PART',
  'COMMISSIONING / TRIAL / CHANGE OVER',
] as const;
export type CategoryType = (typeof CATEGORIES)[number];

export const AST_MACHINES = [
  'AST 2-16L',
  'AST 3-16L',
  'AST 4-16L',
  'AST 5-16L',
  'AST 6-16L',
  'AST 7-16L',
  'AST 8-16L',
  'AST 9-16L',
  'AST 10-16L',
  'AST 11-16L',
  'AST 12-16L',
  'AST 13-12L',
  'AST 14-12L',
  'AST 15-16L',
  'AST 16-16L',
  'AST 17-16L',
  'AST 18-16L',
  'AST 19-16L',
  'AST 20-16L',
  'AST 21-16L',
  'AST 22-16L',
  'AST 23-12L',
  'AST 24-12L',
  'AST 25-12L',
  'AST 26-16L',
  'AST 27-16L',
  'AST 28-16L',
  'AST 29-16L',
  'AST 30-16L',
  'AST 31-12L',
  'AST 32-12L',
  'AST 33-16L',
  'AST 34-16L',
  'AST 35-16L',
  'AST 36-16L',
  'AST 37-12L',
  'AST 38-12L',
  'AST 39-12L',
  'AST 40-12L',
  'AST 41-16L',
  'AST 42-16L',
  'AST 43-16L',
  'AST 44-16L',
  'AST 45-16L',
  'AST 46-16L',
  'AST 47-16L',
  'AST 48-16L',
  'AST 49-16L',
  'AST 50-16L',
  'AST 51-16L',
  'AST 52-16L',
  'AST 53-16L',
  'AST 54-16L',
  'AST 55-16L',
  'AST 61-16L',
  'AST 62-12L',
  'AST 63-16L',
  'AST 65-16L',
  'AST 66-16L',
  'AST 67-16L',
  'AST 68-16L',
  'AST 69-16L',
  'AST 70-16L',
  'AST 71-16L',
  'AST 72-16L',
  'AST 73-12L',
] as const;

export const APK_MACHINES = [
  'APK 9',
  'APK 12',
  'APK 13',
  'APK 15',
  'APK 19',
  'APK 26',
  'APK 31',
  'APK 32',
  'APK 38',
  'APK 40',
  'APK 42',
  'APK 43',
  'APK 44',
  'APK 45',
  'APK 46',
  'APK 54',
  'APK 55',
  'APK 56',
  'APK 58',
  'APK 59',
  'APK 61',
  'APK 63',
] as const;

export const OTHER_MACHINES = [
  'C1',
  'C2',
  'K1',
  'K2',
  'K5',
  'K6',
  'K7',
  'K8',
  'K9',
  'M2',
  'M3',
  'X2',
  'X3',
] as const;

export const MACHINE_OPTIONS = [
  ...AST_MACHINES,
  ...APK_MACHINES,
  ...OTHER_MACHINES,
] as const;

export const OVERHAUL_MACHINES = [
  'AST4S 22-16L',
  'AST 25-12L',
  'AST 44-16L',
  'AST 50-16L',
] as const;

export const USER_ROLES = ['pengawas', 'supervisor', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  canEditAll: boolean;
}

export interface HandoverReport {
  id: string;
  reportDate: string; // YYYY-MM-DD
  shift: ShiftType;
  category: CategoryType;
  machine: string | null;
  information: string;
  issue: string;
  followUp: string;
  palletLocation: string;
  isCompleted: boolean;
  isRepairStart?: boolean;
  createdBy: string;
  createdByName: string;
  updatedBy: string | null;
  updatedByName: string | null;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
}

export interface HandoverFormInput {
  reportDate: string;
  shift: ShiftType;
  category: CategoryType;
  machine: string | null;
  information: string;
  issue: string;
  followUp: string;
  palletLocation: string;
  isCompleted?: boolean;
  isRepairStart?: boolean;
}

export interface HistoryFilters {
  date: string; // '' = semua tanggal, or 'YYYY-MM-DD'
  shift: ShiftType | 'ALL';
  category: CategoryType | 'ALL';
  keyword: string;
}

export type NavSection =
  | 'dashboard'
  | 'input'
  | 'history'
  | 'export'
  | 'settings';
