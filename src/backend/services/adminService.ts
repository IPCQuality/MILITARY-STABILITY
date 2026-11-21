import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import type { ApprovalStatus, UserProfile, UserRole } from '../../shared/types/handover';
import { db } from '../config/firebase';
import {
  formatCaughtError,
  handleFirestoreError,
  normalizeApprovalStatus,
  normalizeUserRole,
  OperationType,
  PRIMARY_ADMIN_EMAIL,
  toIsoString,
} from './firebaseShared';

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
