import { useEffect, useState } from 'react';
import { ChevronRight, LogOut, ShieldCheck } from 'lucide-react';
import type { UserProfile, UserRole } from '../../shared/types/handover';
import { subscribeUsersForAdmin } from '../../backend/services';

interface SettingsViewProps {
  currentUser: UserProfile;
  onLogout: () => void;
  onOpenAdmin?: () => void;
}

function formatRoleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'supervisor') return 'Supervisor';
  return 'Pengawas';
}

function getInitials(name: string, email: string): string {
  const source = name.trim() || email.trim() || 'U';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function SettingsView({
  currentUser,
  onLogout,
  onOpenAdmin,
}: SettingsViewProps) {
  const hasFullAccess = currentUser.canEditAll || currentUser.role !== 'pengawas';
  const isAdmin = currentUser.role === 'admin';

  const [avatarFailed, setAvatarFailed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  useEffect(() => {
    setAvatarFailed(false);
  }, [currentUser.photoURL]);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubscribe = subscribeUsersForAdmin(
      (list) => {
        setPendingCount(list.filter((u) => u.approvalStatus === 'pending').length);
      },
      () => {
        // Abaikan error transient saat menghitung badge pending
      }
    );
    return () => {
      unsubscribe();
    };
  }, [isAdmin]);

  const showGooglePhoto = Boolean(currentUser.photoURL) && !avatarFailed;
  const initials = getInitials(currentUser.fullName, currentUser.email);

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Menu Profil Sederhana (Foto Google, Nama, Email) */}
      <section className="bg-white dark:bg-[#161920] rounded-xl border border-slate-200 dark:border-zinc-800/90 p-5 flex items-center gap-4 shadow-xs">
        {showGooglePhoto ? (
          <img
            src={currentUser.photoURL as string}
            alt={`Foto profil ${currentUser.fullName}`}
            referrerPolicy="no-referrer"
            onError={() => setAvatarFailed(true)}
            className="w-14 h-14 rounded-full object-cover border border-slate-200 dark:border-zinc-700 shrink-0"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-full bg-teal-700 dark:bg-teal-700 text-white font-bold text-base flex items-center justify-center shrink-0 tracking-wide"
          >
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100 truncate">
            {currentUser.fullName}
          </h2>
          <p className="text-xs sm:text-sm font-mono text-slate-500 dark:text-zinc-400 break-all mt-0.5">
            {currentUser.email}
          </p>
        </div>
      </section>

      {/* Detail Profil */}
      <section className="bg-white dark:bg-[#161920] rounded-xl border border-slate-200 dark:border-zinc-800/90 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800/90 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Detail Profil
          </h3>
          <span className="text-xs font-semibold text-teal-700 dark:text-dark-accent">
            {formatRoleLabel(currentUser.role)}
          </span>
        </div>

        <dl className="divide-y divide-slate-100 dark:divide-zinc-800/70 text-sm">
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">
              Nama Lengkap
            </dt>
            <dd className="font-semibold text-slate-900 dark:text-zinc-100">
              {currentUser.fullName}
            </dd>
          </div>
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Email</dt>
            <dd className="font-mono text-xs sm:text-sm text-slate-800 dark:text-zinc-200 break-all">
              {currentUser.email}
            </dd>
          </div>
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Peran Akun</dt>
            <dd className="font-semibold text-slate-900 dark:text-zinc-100">
              {formatRoleLabel(currentUser.role)}
            </dd>
          </div>
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500 dark:text-zinc-400">Hak Akses</dt>
            <dd className="font-semibold text-slate-900 dark:text-zinc-100">
              {hasFullAccess ? 'Akses Penuh' : 'Akses Terbatas'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Tombol Menu Admin (Hanya Admin) */}
      {isAdmin && onOpenAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          className="w-full rounded-xl border border-slate-200 dark:border-zinc-800/90 bg-white dark:bg-[#161920] hover:bg-slate-50 dark:hover:bg-[#1D212A] shadow-xs hover:shadow-sm px-5 py-4 flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/25 text-teal-700 dark:text-dark-accent flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                Menu Admin
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                Persetujuan akun &amp; peran pengguna
                {pendingCount > 0 && (
                  <span className="font-semibold text-amber-700 dark:text-amber-300/90 tabular-nums">
                    {' '}
                    · {pendingCount} menunggu
                  </span>
                )}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
        </button>
      )}

      {/* Tombol Keluar dengan Konfirmasi Inline */}
      <div className="pt-2">
        {!confirmingLogout ? (
          <button
            type="button"
            onClick={() => setConfirmingLogout(true)}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-full border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/35 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.98] inline-flex items-center justify-center gap-2 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar dari Akun</span>
          </button>
        ) : (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-4 space-y-3">
            <p className="text-xs sm:text-sm font-semibold text-rose-900 dark:text-rose-200 text-center">
              Yakin ingin keluar dari akun {currentUser.fullName}?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmingLogout(false)}
                className="min-h-[42px] px-4 py-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#1D212A] hover:bg-slate-50 dark:hover:bg-[#252A35] text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-200 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="min-h-[42px] px-4 py-2 rounded-full bg-rose-700 hover:bg-rose-800 dark:bg-rose-700 dark:hover:bg-rose-600 text-white text-xs sm:text-sm font-semibold shadow-sm inline-flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Ya, Keluar</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
