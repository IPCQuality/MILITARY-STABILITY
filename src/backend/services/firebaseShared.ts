import { Timestamp } from 'firebase/firestore';
import type { ApprovalStatus, UserProfile, UserRole } from '../../shared/types/handover';
import { mapAuthErrorMessage } from '../../domain/handover/handoverLogic';
import { auth, firebaseProjectConfig, testFirestoreConnection } from '../config/firebase';

export { firebaseProjectConfig, testFirestoreConnection };

export const WORKSPACE_ID = 'military-stability';
export const PRIMARY_ADMIN_EMAIL = 'suryadi.k94@gmail.com';

const LEGACY_LOCAL_KEYS = [
  'ms_handover_demo_reports_v1',
  'ms_handover_demo_reports_v2',
  'ms_handover_demo_session_v1',
  'ms_handover_supabase_config_v1',
];

const USER_PROFILE_CACHE_KEY = 'ms_user_profile_cache_v1';

export function isFirestoreOfflineError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code ?? '').toLowerCase()
      : '';
  return (
    code === 'unavailable' ||
    msg.includes('the client is offline') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('unavailable')
  );
}

export function saveCachedUserProfile(profile: UserProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // ignore storage quota errors
  }
}

export function readCachedUserProfile(uid: string): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (parsed && parsed.id === uid && typeof parsed.email === 'string') {
      return {
        id: parsed.id,
        email: parsed.email,
        fullName: String(parsed.fullName || 'Pengawas'),
        role: normalizeUserRole(parsed.role),
        canEditAll: Boolean(parsed.canEditAll),
        approvalStatus: normalizeApprovalStatus(parsed.approvalStatus),
        photoURL: typeof parsed.photoURL === 'string' ? parsed.photoURL : null,
      };
    }
  } catch {
    // ignore invalid cache
  }
  return null;
}

export function clearCachedUserProfile(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(USER_PROFILE_CACHE_KEY);
  } catch {
    // ignore storage errors
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function formatCaughtError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    try {
      const parsed = JSON.parse(err.message) as Partial<FirestoreErrorInfo>;
      if (parsed && typeof parsed.error === 'string') {
        return mapAuthErrorMessage(parsed.error);
      }
    } catch {
      // Bukan JSON FirestoreErrorInfo
    }
    return mapAuthErrorMessage(err.message);
  }
  return fallback;
}

export function normalizeUserRole(rawRole?: string | null): UserRole {
  const lower = (rawRole ?? '').trim().toLowerCase();
  if (lower === 'admin') return 'admin';
  if (lower === 'supervisor') return 'supervisor';
  return 'pengawas';
}

export function normalizeApprovalStatus(
  rawStatus?: string | null,
  isPrimaryAdmin = false
): ApprovalStatus {
  if (isPrimaryAdmin) return 'approved';
  const lower = (rawStatus ?? '').trim().toLowerCase();
  if (lower === 'pending') return 'pending';
  if (lower === 'rejected') return 'rejected';
  if (lower === 'approved') return 'approved';
  return 'approved';
}

export function clearLegacyDemoStorage(): void {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore storage access issues
    }
  }
}

export function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}
