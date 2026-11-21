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
  doc,
  getDoc,
  getDocFromCache,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from 'firebase/firestore';
import type { ApprovalStatus, UserProfile, UserRole } from '../../shared/types/handover';
import { extractOAuthErrorFromUrl, mapAuthErrorMessage } from '../../domain/handover/handoverLogic';
import { auth, db } from '../config/firebase';
import {
  clearCachedUserProfile,
  formatCaughtError,
  handleFirestoreError,
  isFirestoreOfflineError,
  normalizeApprovalStatus,
  normalizeUserRole,
  OperationType,
  PRIMARY_ADMIN_EMAIL,
  readCachedUserProfile,
  saveCachedUserProfile,
} from './firebaseShared';

export { extractOAuthErrorFromUrl, mapAuthErrorMessage };

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
  let cachedSnapData: DocumentData | undefined;
  try {
    const cachedSnap = await getDocFromCache(userRef);
    if (cachedSnap.exists()) {
      cachedSnapData = cachedSnap.data();
    }
  } catch {
    // Not in Firestore IndexedDB cache yet
  }

  const cachedLocalProfile = readCachedUserProfile(firebaseUser.uid);
  const hasFastFallback = Boolean(cachedSnapData || cachedLocalProfile || isPrimaryAdmin);

  try {
    const getPromise = getDoc(userRef);
    const snap = hasFastFallback
      ? await Promise.race([
          getPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
        ])
      : await getPromise;

    if (snap) {
      snapData = snap.exists() ? snap.data() : undefined;
    } else if (cachedSnapData) {
      snapData = cachedSnapData;
    } else if (cachedLocalProfile) {
      return {
        ...cachedLocalProfile,
        photoURL: firebaseUser.photoURL ?? cachedLocalProfile.photoURL ?? null,
      };
    } else if (isPrimaryAdmin) {
      return {
        id: firebaseUser.uid,
        email: userEmail,
        fullName: fallbackName,
        role: 'admin',
        canEditAll: true,
        approvalStatus: 'approved',
        photoURL: firebaseUser.photoURL ?? null,
      };
    }
  } catch (err) {
    if (isFirestoreOfflineError(err)) {
      if (cachedSnapData) {
        snapData = cachedSnapData;
      }

      if (!snapData) {
        if (cachedLocalProfile) {
          return {
            ...cachedLocalProfile,
            photoURL: firebaseUser.photoURL ?? cachedLocalProfile.photoURL ?? null,
          };
        }
        if (isPrimaryAdmin) {
          return {
            id: firebaseUser.uid,
            email: userEmail,
            fullName: fallbackName,
            role: 'admin',
            canEditAll: true,
            approvalStatus: 'approved',
            photoURL: firebaseUser.photoURL ?? null,
          };
        }
      }
    }

    if (!snapData) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }
  }

  if (snapData) {
    const existingRole = normalizeUserRole(String(snapData.role ?? 'pengawas'));
    const effectiveRole: UserRole = isPrimaryAdmin ? 'admin' : existingRole;
    const approvalStatus = normalizeApprovalStatus(
      typeof snapData.approvalStatus === 'string' ? snapData.approvalStatus : undefined,
      isPrimaryAdmin
    );
    const resolvedProfile: UserProfile = {
      id: firebaseUser.uid,
      email: String(snapData.email || userEmail),
      fullName: String(snapData.fullName || fallbackName),
      role: effectiveRole,
      canEditAll: Boolean(snapData.canEditAll) || isPrimaryAdmin || effectiveRole !== 'pengawas',
      approvalStatus,
      photoURL: firebaseUser.photoURL ?? null,
    };
    saveCachedUserProfile(resolvedProfile);
    return resolvedProfile;
  }

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

  const createdProfile: UserProfile = {
    id: firebaseUser.uid,
    email: userEmail,
    fullName: fallbackName,
    role: initialRole,
    canEditAll: initialCanEditAll,
    approvalStatus: initialApprovalStatus,
    photoURL: firebaseUser.photoURL ?? null,
  };
  saveCachedUserProfile(createdProfile);
  return createdProfile;
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
  clearCachedUserProfile();
  await signOut(auth);
}
