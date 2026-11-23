import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, ShieldCheck, X } from 'lucide-react';
import type { ApprovalStatus, UserProfile, UserRole } from '../../shared/types/handover';
import {
  PRIMARY_ADMIN_EMAIL,
  subscribeUsersForAdmin,
  updateUserApprovalByAdmin,
  type AdminManagedUser,
} from '../../backend/services';
import { formatDateTimeId } from '../../domain/handover/handoverLogic';

interface AdminViewProps {
  currentUser: UserProfile;
}

const APPROVAL_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: {
    label: 'Menunggu',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
  },
  approved: {
    label: 'Disetujui',
    className:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
  },
  rejected: {
    label: 'Ditolak',
    className:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
  },
};

function formatRoleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'supervisor') return 'Supervisor';
  return 'Pengawas';
}

export function AdminView({ currentUser }: AdminViewProps) {
  const isAdmin = currentUser.role === 'admin';

  const [managedUsers, setManagedUsers] = useState<AdminManagedUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, UserRole>>({});
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingUsers(true);
    setUsersError(null);

    const unsubscribe = subscribeUsersForAdmin(
      (list) => {
        setManagedUsers(list);
        setLoadingUsers(false);
      },
      (msg) => {
        setUsersError(msg);
        setLoadingUsers(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [isAdmin]);

  const pendingUsers = useMemo(
    () => managedUsers.filter((u) => u.approvalStatus === 'pending'),
    [managedUsers]
  );

  const visibleUsers = useMemo(
    () => (activeTab === 'pending' ? pendingUsers : managedUsers),
    [activeTab, pendingUsers, managedUsers]
  );

  async function handleUpdateApproval(
    target: AdminManagedUser,
    nextStatus: ApprovalStatus,
    overrideRole?: UserRole
  ) {
    setActionMsg(null);
    setSavingUserId(target.id);
    const chosenRole =
      overrideRole ??
      roleDrafts[target.id] ??
      (target.role === 'admin' ? 'pengawas' : target.role);

    try {
      const res = await updateUserApprovalByAdmin(
        target.id,
        { approvalStatus: nextStatus, role: chosenRole },
        currentUser
      );
      if (!res.ok) {
        setActionMsg({
          ok: false,
          text: res.error || 'Gagal memperbarui status akun pengguna.',
        });
        return;
      }
      const statusText =
        nextStatus === 'approved'
          ? `disetujui sebagai ${formatRoleLabel(chosenRole)}`
          : nextStatus === 'rejected'
            ? 'ditolak'
            : 'dikembalikan ke status menunggu';
      setActionMsg({
        ok: true,
        text: `Akun ${target.fullName} (${target.email}) berhasil ${statusText}.`,
      });
    } finally {
      setSavingUserId(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto bg-white dark:bg-[#161920] rounded-xl border border-slate-200 dark:border-zinc-800/90 p-6 text-center text-sm text-slate-600 dark:text-zinc-400">
        Halaman ini hanya dapat diakses oleh Admin.
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <section className="bg-white dark:bg-[#161920] rounded-xl border border-slate-200 dark:border-zinc-800/90 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800/90 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
            Persetujuan Pengguna
          </span>

          <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#11141A] border border-transparent dark:border-zinc-800/80">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap tabular-nums ${
                activeTab === 'pending'
                  ? 'bg-white dark:bg-[#252A35] text-teal-700 dark:text-dark-accent shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Menunggu ({pendingUsers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap tabular-nums ${
                activeTab === 'all'
                  ? 'bg-white dark:bg-[#252A35] text-teal-700 dark:text-dark-accent shadow-sm'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
              }`}
            >
              Semua ({managedUsers.length})
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {actionMsg && (
            <div
              role="status"
              className={`p-3 rounded-lg border text-xs sm:text-sm ${
                actionMsg.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800/60 dark:text-emerald-200'
                  : 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800/60 dark:text-rose-200'
              }`}
            >
              {actionMsg.text}
            </div>
          )}

          {usersError && (
            <div
              role="alert"
              className="p-3 rounded-lg border bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60 text-rose-900 dark:text-rose-200 text-xs sm:text-sm"
            >
              {usersError}
            </div>
          )}

          {loadingUsers ? (
            <p className="text-sm text-slate-500 dark:text-zinc-400 py-8 text-center">
              Memuat daftar pengguna...
            </p>
          ) : visibleUsers.length === 0 ? (
            <div className="py-10 text-center">
              <Clock className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                {activeTab === 'pending'
                  ? 'Tidak ada pendaftaran yang menunggu konfirmasi.'
                  : 'Belum ada pengguna terdaftar.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-zinc-800/90 -mx-5 -mb-5 border-t border-slate-200 dark:border-zinc-800/90">
              {visibleUsers.map((user) => {
                const isPrimaryAdmin =
                  user.email.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL ||
                  user.id === currentUser.id;
                const badge = APPROVAL_BADGE[user.approvalStatus];
                const selectedRole: UserRole =
                  roleDrafts[user.id] ??
                  (user.role === 'admin' ? 'pengawas' : user.role);
                const isSaving = savingUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-[#1D212A] transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {user.fullName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        {isPrimaryAdmin && (
                          <span className="text-[11px] font-semibold text-teal-700 dark:text-dark-accent inline-flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Admin Utama
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-zinc-400">
                        <span className="font-mono text-slate-700 dark:text-zinc-300 break-all">
                          {user.email}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRoleLabel(user.role)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Daftar {formatDateTimeId(user.createdAt)}
                        </span>
                      </div>
                    </div>

                    {!isPrimaryAdmin && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <select
                          aria-label={`Pilih role untuk ${user.fullName}`}
                          value={selectedRole}
                          disabled={isSaving}
                          onChange={(e) =>
                            setRoleDrafts((prev) => ({
                              ...prev,
                              [user.id]: e.target.value as UserRole,
                            }))
                          }
                          className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium border border-slate-300 dark:border-zinc-700/80 rounded-lg bg-white dark:bg-[#11141A] text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600 dark:focus:ring-teal-600/30 dark:focus:border-teal-600"
                        >
                          <option value="pengawas">Pengawas</option>
                          <option value="supervisor">Supervisor</option>
                        </select>

                        {user.approvalStatus !== 'approved' && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              handleUpdateApproval(user, 'approved', selectedRole)
                            }
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-emerald-700/20 dark:shadow-none hover:shadow-md active:scale-[0.97] inline-flex items-center gap-1.5 transition-all whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Setujui
                          </button>
                        )}

                        {user.approvalStatus === 'approved' &&
                          selectedRole !== user.role && (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() =>
                                handleUpdateApproval(user, 'approved', selectedRole)
                              }
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-600 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-teal-700/20 dark:shadow-none hover:shadow-md active:scale-[0.97] transition-all whitespace-nowrap"
                            >
                              Simpan Role
                            </button>
                          )}

                        {user.approvalStatus !== 'rejected' && (
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() =>
                              handleUpdateApproval(user, 'rejected', selectedRole)
                            }
                            className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/35 hover:bg-rose-100 dark:hover:bg-rose-950/60 disabled:opacity-50 text-rose-800 dark:text-rose-300 text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1.5 transition-all whitespace-nowrap"
                          >
                            <X className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
