import { LogOut } from 'lucide-react';
import type { UserProfile } from '../types/handover';

interface SettingsViewProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

export function SettingsView({ currentUser, onLogout }: SettingsViewProps) {
  const hasFullAccess = currentUser.canEditAll || currentUser.role !== 'pengawas';

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Pengaturan &amp; Akun</h2>
        <p className="text-sm text-slate-500">
          Informasi profil dan hak akses akun yang sedang aktif.
        </p>
      </div>

      {/* Profil Pengguna (tanpa shift tetap, mengikuti rolling mingguan) */}
      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 sm:px-6 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Profil Sesi Aktif</h3>
            <p className="text-xs text-slate-500 mt-0.5">Identitas akun terdaftar</p>
          </div>
          <span className="px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-mono font-semibold uppercase text-[#0F294A]">
            {currentUser.role}
          </span>
        </div>

        <dl className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Nama Pengguna</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{currentUser.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-0.5 font-mono text-xs text-slate-800 break-all">
              {currentUser.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Peran Akun</dt>
            <dd className="mt-0.5 font-mono text-xs font-semibold uppercase text-slate-900">
              {currentUser.role}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Hak Akses</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {hasFullAccess ? 'Akses Penuh' : 'Akses Terbatas'}
            </dd>
          </div>
        </dl>

        <div className="px-5 py-4 sm:px-6 bg-slate-50/50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-sm font-semibold inline-flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Keluar (Logout)
          </button>
        </div>
      </section>
    </div>
  );
}
