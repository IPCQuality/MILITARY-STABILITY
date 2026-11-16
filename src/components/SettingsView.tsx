import { useState } from 'react';
import { Cloud, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../types/handover';
import {
  getSupabaseEnvConfig,
  testSupabaseConnection,
} from '../services/handoverService';

interface SettingsViewProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

export function SettingsView({ currentUser, onLogout }: SettingsViewProps) {
  const envCfg = getSupabaseEnvConfig();
  const [connMsg, setConnMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTestConnection() {
    setConnMsg(null);
    setTesting(true);
    try {
      const res = await testSupabaseConnection();
      setConnMsg({ ok: res.ok, text: res.message });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Pengaturan &amp; Akun</h2>
        <p className="text-sm text-slate-500">
          Informasi profil sesi aktif dan status koneksi Supabase Cloud.
        </p>
      </div>

      {/* Profil Pengguna (tanpa shift tetap, mengikuti rolling mingguan) */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Profil Sesi Aktif</h3>
            <p className="text-xs text-slate-500">Autentikasi Supabase Cloud</p>
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
            <span className="text-xs text-slate-500 block">Peran Akun</span>
            <span className="font-medium text-slate-900 uppercase font-mono text-xs">
              {currentUser.role}
            </span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">Hak Akses &amp; Input</span>
            <span className="font-medium text-slate-900">
              {currentUser.canEditAll || currentUser.role !== 'operator'
                ? 'Akses Penuh (Pilih Shift Input Bebas & Edit Semua Laporan)'
                : 'Input Shift (+4 Jam) & Edit Laporan Sendiri Kapanpun'}
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

      {/* Status Koneksi Supabase Cloud (otomatis terpasang dari build, tanpa perlu setup tiap device) */}
      <section className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-[#0F294A]" />
          <h3 className="text-sm font-semibold text-slate-900">
            Status Supabase Cloud
          </h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Koneksi proyek <span className="font-mono text-slate-700">{envCfg.url}</span> sudah
          tertanam otomatis pada aplikasi sehingga tidak perlu konfigurasi ulang saat dibuka di perangkat baru.
        </p>

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
          type="button"
          onClick={handleTestConnection}
          disabled={testing}
          className="min-h-[44px] px-4 py-2 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2"
        >
          {testing ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <ShieldCheck className="w-4 h-4" />
          )}
          <span>Uji Koneksi Supabase</span>
        </button>
      </section>
    </div>
  );
}
