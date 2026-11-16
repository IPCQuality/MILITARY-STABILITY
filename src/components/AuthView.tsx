import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import type { UserProfile } from '../types/handover';
import {
  getSupabaseConfigIssue,
  isSupabaseConfigured,
  signInSupabase,
  signUpSupabase,
} from '../services/handoverService';

interface AuthViewProps {
  onAuthenticated: (user: UserProfile) => void;
  sessionNotice?: string | null;
}

export function AuthView({ onAuthenticated, sessionNotice }: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const supabaseReady = isSupabaseConfigured();
  const configIssue = getSupabaseConfigIssue();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Email dan kata sandi wajib diisi.');
      return;
    }

    setLoading(true);
    try {
      if (tab === 'login') {
        const res = await signInSupabase(email, password);
        if (res.error || !res.user) {
          setErrorMsg(res.error || 'Gagal login.');
          return;
        }
        onAuthenticated(res.user);
      } else {
        if (!fullName.trim()) {
          setErrorMsg('Nama lengkap wajib diisi untuk registrasi.');
          return;
        }
        if (password.length < 6) {
          setErrorMsg('Kata sandi minimal 6 karakter.');
          return;
        }
        const res = await signUpSupabase({
          email,
          password,
          fullName,
        });
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        if (res.needsEmailConfirm) {
          setInfoMsg(
            'Akun berhasil dibuat. Periksa inbox email Anda untuk konfirmasi sebelum login.'
          );
          setTab('login');
          return;
        }
        if (res.user) {
          onAuthenticated(res.user);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-center py-8 px-4 sm:px-6">
      <div className="max-w-md w-full mx-auto space-y-4">
        {/* Compact Brand Banner */}
        <div className="bg-[#0F294A] text-white rounded-xl px-6 py-5 border border-slate-800 shadow-xs">
          <p className="text-[11px] font-mono tracking-wider text-slate-300 uppercase">
            Shift Handover Log
          </p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight">
            MILITARY &amp; STABILITY
          </h1>
          <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">
            Masuk menggunakan akun terdaftar untuk mencatat &amp; memantau handover antar-shift.
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white rounded-xl border border-slate-300 p-6 space-y-5 shadow-xs">
          {sessionNotice && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm"
            >
              {sessionNotice}
            </div>
          )}

          {!supabaseReady && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed"
            >
              {configIssue === 'secret_key' ? (
                <>
                  Key yang terpasang pada build adalah <strong>secret / service_role key</strong> yang dilarang dipakai di browser. Ganti nilai{' '}
                  <code className="font-mono font-semibold">VITE_SUPABASE_PUBLISHABLE_KEY</code> di GitHub → Settings → Secrets and variables → Actions dengan{' '}
                  <strong>Publishable key</strong> (<code className="font-mono">sb_publishable_...</code>) atau <strong>anon public</strong> key, lalu jalankan ulang workflow deploy.
                </>
              ) : (
                <>
                  Variabel build <code className="font-mono font-semibold">VITE_SUPABASE_PUBLISHABLE_KEY</code> belum terpasang pada hasil build ini. Pastikan sudah ditambahkan sebagai <strong>Repository variable</strong> atau <strong>Repository secret</strong> di GitHub → Settings → Secrets and variables → Actions (bukan di Environments/Codespaces), lalu commit workflow <code className="font-mono">.github/workflows/deploy.yml</code> terbaru dan jalankan ulang <strong>Run workflow</strong>.
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                {tab === 'login' ? 'Masuk Akun' : 'Registrasi Akun'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {supabaseReady
                  ? 'Autentikasi Supabase Cloud aktif'
                  : 'Menunggu konfigurasi environment build'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  tab === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Registrasi
              </button>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div
              role="status"
              className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm"
            >
              {infoMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label
                  htmlFor="auth-fullname"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Nama Lengkap
                </label>
                <input
                  id="auth-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Suryadi"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Email Pengguna
              </label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full min-h-[44px] pl-3.5 pr-11 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] flex items-center justify-center text-slate-500 hover:text-slate-800"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !supabaseReady}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-lg bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {tab === 'login' ? (
                <LogIn className="w-4 h-4 shrink-0" />
              ) : (
                <UserPlus className="w-4 h-4 shrink-0" />
              )}
              <span>
                {loading
                  ? 'Memproses...'
                  : tab === 'login'
                    ? 'Masuk ke Aplikasi'
                    : 'Buat Akun Baru'}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
