import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore';
import type {
  ActivityStage,
  ApprovalStatus,
  CategoryType,
  HandoverFormInput,
  HandoverReport,
  MilitaryStatus,
  ShiftType,
  StabilityPhase,
  StabilityStatus,
  UserProfile,
  UserRole,
} from '../types/handover';
import {
  canSubmitReport,
  extractOAuthErrorFromUrl,
  mapAuthErrorMessage,
  validateHandoverInput,
} from '../utils/handoverLogic';
import {
  auth,
  db,
  firebaseProjectConfig,
  testFirestoreConnection,
} from '../lib/firebase';

export {
  extractOAuthErrorFromUrl,
  firebaseProjectConfig,
  mapAuthErrorMessage,
  testFirestoreConnection,
};

export const WORKSPACE_ID = 'military-stability';
export const PRIMARY_ADMIN_EMAIL = 'suryadi.k94@gmail.com';

const LEGACY_LOCAL_KEYS = [
  'ms_handover_demo_reports_v1',
  'ms_handover_demo_reports_v2',
  'ms_handover_demo_session_v1',
  'ms_handover_supabase_config_v1',
];

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

function formatCaughtError(err: unknown, fallback: string): string {
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
  // Akun lama sebelum fitur approval dianggap sudah disetujui
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

function toIsoString(value: unknown): string {
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

function mapDocToReport(id: string, data: DocumentData): HandoverReport {
  return {
    id,
    reportDate: String(data.reportDate ?? ''),
    shift: (data.shift as ShiftType) ?? 'Shift 1',
    category: (data.category as CategoryType) ?? 'OVERHAUL',
    machine: data.machine ? String(data.machine) : null,
    information: String(data.information ?? ''),
    followUp: String(data.followUp ?? ''),
    palletLocation: String(data.palletLocation ?? ''),
    isCompleted: Boolean(data.isCompleted),
    isRepairStart: typeof data.isRepairStart === 'boolean' ? data.isRepairStart : undefined,
    activityStage:
      typeof data.activityStage === 'string'
        ? (data.activityStage as ActivityStage)
        : undefined,
    militaryRound:
      typeof data.militaryRound === 'number' ? data.militaryRound : undefined,
    militaryStatus:
      typeof data.militaryStatus === 'string'
        ? (data.militaryStatus as MilitaryStatus)
        : undefined,
    militaryLeakBoxes:
      typeof data.militaryLeakBoxes === 'number' ? data.militaryLeakBoxes : undefined,
    stabilityPhase:
      typeof data.stabilityPhase === 'string'
        ? (data.stabilityPhase as StabilityPhase)
        : undefined,
    stabilityStatus:
      typeof data.stabilityStatus === 'string'
        ? (data.stabilityStatus as StabilityStatus)
        : undefined,
    createdBy: String(data.createdBy ?? ''),
    createdByName: String(data.createdByName ?? ''),
    updatedBy: data.updatedBy ? String(data.updatedBy) : null,
    updatedByName: data.updatedByName ? String(data.updatedByName) : null,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

function sortReportsNewestFirst(list: HandoverReport[]): HandoverReport[] {
  return [...list].sort((a, b) => {
    if (a.reportDate !== b.reportDate) {
      return b.reportDate.localeCompare(a.reportDate);
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

// ============================================================================
// Firebase Auth & Profile Operations
// ============================================================================

export async function ensureFirebaseUserProfile(
  firebaseUser: User,
  overrideFullName?: string
): Promise<UserProfile> {
  const userEmail = (firebaseUser.email ?? '').trim();
  const isPrimaryAdmin =
    Boolean(firebaseUser.emailVerified) &&
    userEmail.toLowerCase() === PRIMARY_ADMIN_EMAIL;

  const fallbackName = (
    overrideFullName ||
    firebaseUser.displayName ||
    userEmail.split('@')[0] ||
    'Pengawas'
  )
    .trim()
    .slice(0, 120) || 'Pengawas';

  const userPath = `users/${firebaseUser.uid}`;
  const userRef = doc(db, 'users', firebaseUser.uid);

  let snapData: DocumentData | undefined;
  try {
    const snap = await getDoc(userRef);
    snapData = snap.exists() ? snap.data() : undefined;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, userPath);
  }

  if (snapData) {
    const existingRole = normalizeUserRole(String(snapData.role ?? 'pengawas'));
    const effectiveRole: UserRole = isPrimaryAdmin ? 'admin' : existingRole;
    const approvalStatus = normalizeApprovalStatus(
      typeof snapData.approvalStatus === 'string' ? snapData.approvalStatus : undefined,
      isPrimaryAdmin
    );
    return {
      id: firebaseUser.uid,
      email: String(snapData.email || userEmail),
      fullName: String(snapData.fullName || fallbackName),
      role: effectiveRole,
      canEditAll: Boolean(snapData.canEditAll) || isPrimaryAdmin || effectiveRole !== 'pengawas',
      approvalStatus,
      photoURL: firebaseUser.photoURL ?? null,
    };
  }

  // Setiap akun baru otomatis terdaftar dengan role default 'pengawas'
  // dan status 'pending' menunggu konfirmasi Admin (kecuali admin utama).
  const initialRole: UserRole = isPrimaryAdmin ? 'admin' : 'pengawas';
  const initialCanEditAll = isPrimaryAdmin;
  const initialApprovalStatus: ApprovalStatus = isPrimaryAdmin ? 'approved' : 'pending';

  try {
    await setDoc(userRef, {
      id: firebaseUser.uid,
      email: userEmail.slice(0, 200),
      fullName: fallbackName,
      role: initialRole,
      canEditAll: initialCanEditAll,
      approvalStatus: initialApprovalStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, userPath);
  }

  return {
    id: firebaseUser.uid,
    email: userEmail,
    fullName: fallbackName,
    role: initialRole,
    canEditAll: initialCanEditAll,
    approvalStatus: initialApprovalStatus,
    photoURL: firebaseUser.photoURL ?? null,
  };
}

export interface AdminManagedUser extends UserProfile {
  createdAt: string;
  updatedAt: string;
}

export function subscribeUsersForAdmin(
  onData: (users: AdminManagedUser[]) => void,
  onError: (message: string) => void
): () => void {
  const usersPath = 'users';
  return onSnapshot(
    collection(db, usersPath),
    (snapshot) => {
      const mapped: AdminManagedUser[] = snapshot.docs.map((d) => {
        const data = d.data();
        const email = String(data.email ?? '');
        const isPrimaryAdmin = email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
        const role = isPrimaryAdmin
          ? 'admin'
          : normalizeUserRole(String(data.role ?? 'pengawas'));
        return {
          id: d.id,
          email,
          fullName: String(data.fullName ?? 'Pengawas'),
          role,
          canEditAll: Boolean(data.canEditAll) || role !== 'pengawas',
          approvalStatus: normalizeApprovalStatus(
            typeof data.approvalStatus === 'string' ? data.approvalStatus : undefined,
            isPrimaryAdmin
          ),
          createdAt: toIsoString(data.createdAt),
          updatedAt: toIsoString(data.updatedAt),
        };
      });

      const statusRank: Record<ApprovalStatus, number> = {
        pending: 0,
        approved: 1,
        rejected: 2,
      };
      mapped.sort((a, b) => {
        const rankDiff = statusRank[a.approvalStatus] - statusRank[b.approvalStatus];
        if (rankDiff !== 0) return rankDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      onData(mapped);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, usersPath);
      } catch (thrown) {
        onError(formatCaughtError(thrown, 'Gagal memuat daftar konfirmasi pengguna.'));
      }
    }
  );
}

export async function updateUserApprovalByAdmin(
  targetUserId: string,
  updates: { approvalStatus: ApprovalStatus; role?: UserRole },
  adminUser: UserProfile
): Promise<{ ok: boolean; error?: string }> {
  if (adminUser.role !== 'admin') {
    return { ok: false, error: 'Hanya Admin yang dapat mengonfirmasi akun pengguna.' };
  }

  const nextRole: UserRole = normalizeUserRole(updates.role ?? 'pengawas');
  const nextCanEditAll = nextRole !== 'pengawas';
  const userPath = `users/${targetUserId}`;
  const userRef = doc(db, 'users', targetUserId);

  try {
    await updateDoc(userRef, {
      approvalStatus: updates.approvalStatus,
      role: nextRole,
      canEditAll: nextCanEditAll,
      updatedAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.UPDATE, userPath);
    } catch (thrown) {
      return {
        ok: false,
        error: formatCaughtError(thrown, 'Gagal memperbarui status persetujuan pengguna.'),
      };
    }
  }
}

export async function signInWithGoogleFirebase(): Promise<{
  user?: UserProfile;
  error?: string;
}> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const cred = await signInWithPopup(auth, provider);
    const profile = await ensureFirebaseUserProfile(cred.user);
    return { user: profile };
  } catch (err) {
    return { error: formatCaughtError(err, 'Gagal login menggunakan Google.') };
  }
}

export async function signInFirebase(
  email: string,
  password: string
): Promise<{ user?: UserProfile; error?: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    if (!cred.user.emailVerified) {
      await sendEmailVerification(cred.user).catch(() => undefined);
      await signOut(auth);
      return {
        error:
          'Email akun Anda belum diverifikasi. Kami telah mengirim ulang email verifikasi; cek inbox Anda lalu login kembali.',
      };
    }
    const profile = await ensureFirebaseUserProfile(cred.user);
    return { user: profile };
  } catch (err) {
    return { error: formatCaughtError(err, 'Gagal login.') };
  }
}

export async function signUpFirebase(params: {
  email: string;
  password: string;
  fullName: string;
}): Promise<{ user?: UserProfile; needsEmailConfirm?: boolean; error?: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(
      auth,
      params.email.trim(),
      params.password
    );
    const trimmedName = params.fullName.trim().slice(0, 120);
    if (trimmedName) {
      await updateProfile(cred.user, { displayName: trimmedName }).catch(() => undefined);
    }

    if (!cred.user.emailVerified) {
      await sendEmailVerification(cred.user).catch(() => undefined);
      await signOut(auth);
      return { needsEmailConfirm: true };
    }

    const profile = await ensureFirebaseUserProfile(cred.user, trimmedName);
    return { user: profile };
  } catch (err) {
    return { error: formatCaughtError(err, 'Gagal membuat akun baru.') };
  }
}

export async function resetPasswordFirebase(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim();
  if (!trimmed) {
    return { ok: false, error: 'Masukkan alamat email terlebih dahulu.' };
  }
  try {
    await sendPasswordResetEmail(auth, trimmed);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: formatCaughtError(err, 'Gagal mengirim email reset kata sandi.'),
    };
  }
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

// ============================================================================
// Firestore Handover Reports Operations
// ============================================================================

export function subscribeReportsFirebase(
  onData: (reports: HandoverReport[]) => void,
  onError: (message: string) => void
): () => void {
  const reportsPath = 'handover_reports';
  const q = query(
    collection(db, reportsPath),
    where('workspaceId', '==', WORKSPACE_ID)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const mapped = snapshot.docs.map((d) => mapDocToReport(d.id, d.data()));
      onData(sortReportsNewestFirst(mapped));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, reportsPath);
      } catch (thrown) {
        onError(formatCaughtError(thrown, 'Gagal memuat data handover dari Firestore.'));
      }
    }
  );
}

export async function loadReportsFirebase(): Promise<{
  reports: HandoverReport[];
  error?: string;
}> {
  const reportsPath = 'handover_reports';
  const q = query(
    collection(db, reportsPath),
    where('workspaceId', '==', WORKSPACE_ID)
  );

  try {
    const snapshot = await getDocs(q);
    const mapped = snapshot.docs.map((d) => mapDocToReport(d.id, d.data()));
    return { reports: sortReportsNewestFirst(mapped) };
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.LIST, reportsPath);
    } catch (thrown) {
      return {
        reports: [],
        error: formatCaughtError(thrown, 'Gagal memuat data laporan dari Firestore.'),
      };
    }
  }
}

export async function createReportFirebase(
  input: HandoverFormInput,
  user: UserProfile
): Promise<{ report?: HandoverReport; error?: string }> {
  const permission = canSubmitReport({
    user,
    input,
    editingReport: null,
  });
  if (!permission.allowed) {
    return { error: permission.reason || 'Anda tidak memiliki izin membuat laporan ini.' };
  }

  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  const newDocRef = doc(collection(db, 'handover_reports'));
  const docPath = `handover_reports/${newDocRef.id}`;
  const actorName = (user.fullName || 'Pengawas').trim().slice(0, 120) || 'Pengawas';
  const sanitizedMachine = (validation.sanitizedMachine || '').trim().slice(0, 64);

  const payload: DocumentData = {
    id: newDocRef.id,
    workspaceId: WORKSPACE_ID,
    reportDate: input.reportDate,
    shift: input.shift,
    category: input.category,
    machine: sanitizedMachine,
    information: input.information.trim().slice(0, 2000),
    followUp: input.followUp.trim().slice(0, 2000),
    palletLocation: (input.palletLocation ?? '').trim().slice(0, 200),
    isCompleted: Boolean(input.isCompleted),
    isRepairStart: Boolean(input.isRepairStart),
    ...(input.activityStage ? { activityStage: input.activityStage } : {}),
    ...(typeof input.militaryRound === 'number' ? { militaryRound: input.militaryRound } : {}),
    ...(input.militaryStatus ? { militaryStatus: input.militaryStatus } : {}),
    ...(typeof input.militaryLeakBoxes === 'number'
      ? { militaryLeakBoxes: input.militaryLeakBoxes }
      : {}),
    ...(input.stabilityPhase ? { stabilityPhase: input.stabilityPhase } : {}),
    ...(input.stabilityStatus ? { stabilityStatus: input.stabilityStatus } : {}),
    createdBy: user.id,
    createdByName: actorName,
    updatedBy: user.id,
    updatedByName: actorName,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(newDocRef, payload);
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.CREATE, docPath);
    } catch (thrown) {
      return {
        error: formatCaughtError(thrown, 'Gagal menyimpan laporan ke Firestore.'),
      };
    }
  }

  const nowIso = new Date().toISOString();
  return {
    report: {
      id: newDocRef.id,
      reportDate: payload.reportDate,
      shift: payload.shift,
      category: payload.category,
      machine: payload.machine,
      information: payload.information,
      followUp: payload.followUp,
      palletLocation: payload.palletLocation,
      isCompleted: payload.isCompleted,
      isRepairStart: payload.isRepairStart,
      activityStage: input.activityStage,
      militaryRound: input.militaryRound,
      militaryStatus: input.militaryStatus,
      militaryLeakBoxes: input.militaryLeakBoxes,
      stabilityPhase: input.stabilityPhase,
      stabilityStatus: input.stabilityStatus,
      createdBy: payload.createdBy,
      createdByName: payload.createdByName,
      updatedBy: payload.updatedBy,
      updatedByName: payload.updatedByName,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

export async function updateReportFirebase(
  reportId: string,
  input: HandoverFormInput,
  user: UserProfile,
  existingReport?: HandoverReport
): Promise<{ report?: HandoverReport; error?: string }> {
  if (existingReport) {
    const permission = canSubmitReport({
      user,
      input,
      editingReport: existingReport,
    });
    if (!permission.allowed) {
      return { error: permission.reason || 'Anda tidak memiliki izin mengedit laporan ini.' };
    }
  }

  const validation = validateHandoverInput(input);
  if (!validation.valid) {
    const firstErr = Object.values(validation.errors)[0] || 'Data laporan tidak valid.';
    return { error: firstErr };
  }

  const docPath = `handover_reports/${reportId}`;
  const reportRef = doc(db, 'handover_reports', reportId);
  const actorName = (user.fullName || 'Pengawas').trim().slice(0, 120) || 'Pengawas';
  const sanitizedMachine = (validation.sanitizedMachine || '').trim().slice(0, 64);

  const updates: DocumentData = {
    reportDate: input.reportDate,
    shift: input.shift,
    category: input.category,
    machine: sanitizedMachine,
    information: input.information.trim().slice(0, 2000),
    issue: deleteField(),
    followUp: input.followUp.trim().slice(0, 2000),
    palletLocation: (input.palletLocation ?? '').trim().slice(0, 200),
    isCompleted: Boolean(input.isCompleted),
    isRepairStart: Boolean(input.isRepairStart),
    activityStage: input.activityStage ? input.activityStage : deleteField(),
    militaryRound:
      input.activityStage === 'MILITARY' && typeof input.militaryRound === 'number'
        ? input.militaryRound
        : deleteField(),
    militaryStatus:
      input.activityStage === 'MILITARY' && input.militaryStatus
        ? input.militaryStatus
        : deleteField(),
    militaryLeakBoxes:
      input.activityStage === 'MILITARY' &&
      input.militaryStatus === 'LEAK' &&
      typeof input.militaryLeakBoxes === 'number'
        ? input.militaryLeakBoxes
        : deleteField(),
    stabilityPhase:
      input.activityStage === 'STABILITY' && input.stabilityPhase
        ? input.stabilityPhase
        : deleteField(),
    stabilityStatus:
      input.activityStage === 'STABILITY' && input.stabilityStatus
        ? input.stabilityStatus
        : deleteField(),
    updatedBy: user.id,
    updatedByName: actorName,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(reportRef, updates);
  } catch (err) {
    try {
      handleFirestoreError(err, OperationType.UPDATE, docPath);
    } catch (thrown) {
      return {
        error: formatCaughtError(
          thrown,
          'Gagal memperbarui laporan. Pastikan Anda memiliki izin edit.'
        ),
      };
    }
  }

  return {
    report: {
      id: reportId,
      reportDate: updates.reportDate,
      shift: updates.shift,
      category: updates.category,
      machine: updates.machine,
      information: updates.information,
      followUp: updates.followUp,
      palletLocation: updates.palletLocation,
      isCompleted: updates.isCompleted,
      isRepairStart: updates.isRepairStart,
      activityStage: input.activityStage,
      militaryRound:
        input.activityStage === 'MILITARY' ? input.militaryRound : undefined,
      militaryStatus:
        input.activityStage === 'MILITARY' ? input.militaryStatus : undefined,
      militaryLeakBoxes:
        input.activityStage === 'MILITARY' && input.militaryStatus === 'LEAK'
          ? input.militaryLeakBoxes
          : undefined,
      stabilityPhase:
        input.activityStage === 'STABILITY' ? input.stabilityPhase : undefined,
      stabilityStatus:
        input.activityStage === 'STABILITY' ? input.stabilityStatus : undefined,
      createdBy: existingReport?.createdBy ?? user.id,
      createdByName: existingReport?.createdByName ?? actorName,
      updatedBy: updates.updatedBy,
      updatedByName: updates.updatedByName,
      createdAt: existingReport?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}
