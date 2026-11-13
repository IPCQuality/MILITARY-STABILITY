import { useState, type FormEvent } from 'react';
import { KeyRound, LogOut, RefreshCw, RotateCcw, ShieldCheck, UserCheck } from 'lucide-react';
import type { UserProfile } from '../types/handover';
import { DEMO_ACCOUNTS } from '../utils/demoSeed';
import {
  DEFAULT_SUPABASE_URL,
  getStoredSupabaseConfig,
  resetDemoData,
  saveSupabaseConfig,
  signInDemoAccount,
  testSupabaseConnection,
} from '../services/handoverService';

interface SettingsViewProps {
  currentUser: UserProfile;
  mode: 'supabase' | 'demo';
  onSwitchDemoUser: (user: UserProfile) => void;
  onResetDemo: () => void;
  onLogout: () => void;
}

export function SettingsView({
  currentUser,
  mode,
  onSwitchDemoUser,
  onResetDemo,
  onLogout,
}: SettingsViewProps) {
  const stored = getStoredSupabaseConfig();
  const [url, setUrl] = useState(stored.url || DEFAULT_SUPABASE_URL);
  const [publishableKey, setPublishableKey] = useState(stored.publishableKey);
  const [connMsg, setConnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleSaveAndTest(e: FormEvent) {
    e.preventDefault();
    setConnMsg(null);
    const saved = saveSupabaseConfig({ url, publishableKey });
    if (!saved.ok) {
      setConnMsg({ ok: false, text: saved.error || 'Gagal menyimpan konfigurasi.' });
      return;
    }

    setTesting(true);
    try {
      const res = await testSupabaseConnection();
      setConnMsg({ ok: res.ok, text: res.message });
    } finally {
      setTesting(false);
    }
  }

  function handleResetDemoClick() {
    resetDemoData();
    onResetDemo();
    setConnMsg({ ok: true, text: 'Data simulasi lokal berhasil dikembalikan ke kondisi awal.' });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Pengaturan &amp; Koneksi</h2>
        <p className="text-sm text-slate-500">
          Kelola sesi pengguna, peran akses, dan konfigurasi Supabase Cloud.
        </p>
      </div>

      {/* Profil Pengguna */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Profil Sesi Aktif</h3>
            <p className="text-xs text-slate-500">
              {mode === 'supabase' ? 'Autentikasi Supabase Cloud' : 'Mode Simulasi Multiuser Lokal'}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-xs font-mono uppercase text-slate-700">
            {currentUser.role}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pt-2 border-t border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">Nama Pengguna</span>
            <span className="font-medium text-slate-900">{currentUser.fullName}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Email</span>
            <span className="font-mono text-xs text-slate-800">{currentUser.email}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Shift Default</span>
            <span className="font-medium text-slate-900">{currentUser.defaultShift}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Izin Edit Laporan</span>
            <span className="font-medium text-slate-900">
              {currentUser.canEditAll || currentUser.role !== 'operator'
                ? 'Semua Laporan Shift (Supervisor/Admin)'
                : 'Laporan Milik Sendiri'}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[44px] px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-sm font-semibold inline-flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Keluar (Logout)
          </button>
        </div>
      </section>

      {/* Switch Demo Account (Only in Demo Mode) */}
      {mode === 'demo' && (
        <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Uji Multiuser Antar-Shift (Mode Simulasi)
              </h3>
              <p className="text-xs text-slate-500">
                Ganti akun aktif untuk menguji visibilitas lintas shift dan batasan hak edit.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetDemoClick}
              className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Data Demo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DEMO_ACCOUNTS.map((acc) => {
              const active = acc.profile.id === currentUser.id;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    const user = signInDemoAccount(acc.email);
                    onSwitchDemoUser(user);
                  }}
                  className={`min-h-[44px] p-3 rounded-lg border text-left transition-colors ${
                    active
                      ? 'border-[#0F294A] bg-blue-50/70 text-[#0F294A]'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">{acc.profile.fullName}</span>
                    {active && <UserCheck className="w-4 h-4 shrink-0" />}
                  </div>
                  <p className="mt-0.5 text-[11px] font-mono text-slate-500">
                    {acc.profile.defaultShift} · {acc.profile.role}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Supabase Configuration */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#0F294A]" />
          <h3 className="text-sm font-semibold text-slate-900">
            Konfigurasi Supabase Cloud
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Gunakan hanya <strong>Publishable Key</strong> atau <strong>anon public key</strong> dari
          dashboard Supabase. Jangan pernah memasukkan <code>service_role</code> key.
        </p>

        <form onSubmit={handleSaveAndTest} className="space-y-4">
          <div>
            <label htmlFor="settings-sb-url" className="block text-xs font-medium text-slate-700 mb-1">
              Project URL
            </label>
            <input
              id="settings-sb-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
            />
          </div>

          <div>
            <label htmlFor="settings-sb-key" className="block text-xs font-medium text-slate-700 mb-1">
              Publishable Key / Anon Public Key
            </label>
            <input
              id="settings-sb-key"
              type="text"
              value={publishableKey}
              onChange={(e) => setPublishableKey(e.target.value)}
              placeholder="sb_publishable_... atau eyJ..."
              className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
            />
          </div>

          {connMsg && (
            <div
              role="status"
              className={`p-3 rounded-lg border text-xs ${
                connMsg.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {connMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={testing}
            className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            {testing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            <span>Simpan &amp; Uji Koneksi</span>
          </button>
        </form>
      </section>
    </div>
  );
}
