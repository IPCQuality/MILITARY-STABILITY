export const SHIFTS = ['Shift 1', 'Shift 2', 'Shift 3'] as const;
export type ShiftType = (typeof SHIFTS)[number];

export const CATEGORIES = [
  'OVERHAUL',
  'STABILITY TINGGI',
  'CASE PERBAIKAN PART',
  'COMMISSIONING / TRIAL / CHANGE OVER',
] as const;
export type CategoryType = (typeof CATEGORIES)[number];

export const OVERHAUL_MACHINES = [
  'AST4S 22-16L',
  'AST 25-12L',
  'AST 44-16L',
  'AST 50-16L',
] as const;

export const SUGGESTED_MACHINES = [
  'AST4S 22-16L',
  'AST 25-12L',
  'AST 44-16L',
  'AST 50-16L',
  'AST 9-16L',
  'AST 67-16L',
  'AST 14-12L',
] as const;

export type UserRole = 'operator' | 'supervisor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  defaultShift: ShiftType;
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
  isCompleted: boolean;
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
  isCompleted?: boolean;
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
