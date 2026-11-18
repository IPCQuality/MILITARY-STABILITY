import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, LogOut, ShieldCheck, UserCheck, X } from 'lucide-react';
import type { ApprovalStatus, UserProfile, UserRole } from '../types/handover';
import {
  PRIMARY_ADMIN_EMAIL,
  subscribeUsersForAdmin,
  updateUserApprovalByAdmin,
  type AdminManagedUser,
} from '../services/handoverService';
import { formatDateTimeId } from '../utils/handoverLogic';

interface SettingsViewProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

const APPROVAL_BADGE: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: {
    label: 'Menunggu Konfirmasi',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  approved: {
    label: 'Disetujui',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  rejected: {
    label: 'Ditolak',
    className: 'bg-rose-50 text-rose-800 border-rose-200',
  },
};

function formatRoleLabel(role: UserRole): string {
  if (role === 'admin') return 'Admin';
  if (role === 'supervisor') return 'Supervisor';
  return 'Pengawas';
}

export function SettingsView({ currentUser, onLogout }: SettingsViewProps) {
  const hasFullAccess = currentUser.canEditAll || currentUser.role !== 'pengawas';
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
            Pengaturan Akun
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Profil sesi aktif dan pengelolaan persetujuan pengguna.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="min-h-[40px] px-5 py-2 rounded-full border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs sm:text-sm font-semibold shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center justify-center gap-2 self-start sm:self-auto transition-all whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>

      {/* Profil Pengguna */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-900">Informasi Akun</h3>
          <span className="text-xs font-semibold text-[#0F294A]">
            {formatRoleLabel(currentUser.role)}
          </span>
        </div>

        <dl className="divide-y divide-slate-100 text-sm">
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500">Nama Pengguna</dt>
            <dd className="font-semibold text-slate-900">{currentUser.fullName}</dd>
          </div>
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500">Email</dt>
            <dd className="font-mono text-xs sm:text-sm text-slate-800 break-all">
              {currentUser.email}
            </dd>
          </div>
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500">Peran Akun</dt>
            <dd className="font-semibold text-slate-900">{formatRoleLabel(currentUser.role)}</dd>
          </div>
          <div className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <dt className="text-xs font-medium text-slate-500">Hak Akses</dt>
            <dd className="font-semibold text-slate-900">
              {hasFullAccess ? 'Akses Penuh' : 'Akses Terbatas'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Panel Khusus Admin: Konfirmasi Pendaftaran Pengguna Baru */}
      {isAdmin && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <UserCheck className="w-4 h-4 text-[#0F294A] mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Persetujuan Pengguna
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Konfirmasi akun baru sebelum diizinkan mengakses laporan.
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-slate-100">
              <button
                type="button"
                onClick={() => setActiveTab('pending')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap tabular-nums ${
                  activeTab === 'pending'
                    ? 'bg-white text-[#0F294A] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Menunggu ({pendingUsers.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap tabular-nums ${
                  activeTab === 'all'
                    ? 'bg-white text-[#0F294A] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
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
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {actionMsg.text}
              </div>
            )}

            {usersError && (
              <div
                role="alert"
                className="p-3 rounded-lg border bg-rose-50 border-rose-200 text-rose-900 text-xs sm:text-sm"
              >
                {usersError}
              </div>
            )}

            {loadingUsers ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                Memuat daftar pengguna...
              </p>
            ) : visibleUsers.length === 0 ? (
              <div className="py-8 text-center">
                <Clock className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {activeTab === 'pending'
                    ? 'Tidak ada pendaftaran yang menunggu konfirmasi.'
                    : 'Belum ada pengguna terdaftar.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 -mx-5 -mb-5 border-t border-slate-200">
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
                      className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 truncate">
                            {user.fullName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          {isPrimaryAdmin && (
                            <span className="text-[11px] font-semibold text-[#0F294A] inline-flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Admin Utama
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span className="font-mono text-slate-700 break-all">{user.email}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatRoleLabel(user.role)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">Daftar {formatDateTimeId(user.createdAt)}</span>
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
                            className="min-h-[38px] px-2.5 py-1.5 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
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
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-emerald-700/20 hover:shadow-md active:scale-[0.97] inline-flex items-center gap-1.5 transition-all whitespace-nowrap"
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
                                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-xs font-semibold shadow-sm shadow-[#0F294A]/20 hover:shadow-md active:scale-[0.97] transition-all whitespace-nowrap"
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
                              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-800 text-xs font-semibold shadow-xs hover:shadow-sm active:scale-[0.97] inline-flex items-center gap-1.5 transition-all whitespace-nowrap"
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
      )}
    </div>
  );
}
