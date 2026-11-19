import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import type { UserProfile } from '../types/handover';
import {
  resetPasswordFirebase,
  signInFirebase,
  signInWithGoogleFirebase,
  signUpFirebase,
} from '../services/handoverService';
import { BrandLogo } from './BrandLogo';

interface AuthViewProps {
  onAuthenticated: (user: UserProfile) => void;
  sessionNotice?: string | null;
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function AuthView({ onAuthenticated, sessionNotice }: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function handleForgotPassword() {
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg('Masukkan email akun Anda pada kolom Email Pengguna terlebih dahulu untuk reset kata sandi.');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await resetPasswordFirebase(email);
      if (!res.ok) {
        setErrorMsg(res.error || 'Gagal mengirim tautan reset kata sandi.');
        return;
      }
      setInfoMsg(
        `Tautan reset kata sandi telah dikirim ke ${email.trim()}. Periksa inbox atau folder spam Anda.`
      );
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleGoogleAuth() {
    setErrorMsg(null);
    setInfoMsg(null);
    setGoogleLoading(true);
    try {
      const res = await signInWithGoogleFirebase();
      if (res.error || !res.user) {
        if (res.error) setErrorMsg(res.error);
        return;
      }
      onAuthenticated(res.user);
    } finally {
      setGoogleLoading(false);
    }
  }

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
        const res = await signInFirebase(email, password);
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
        const res = await signUpFirebase({
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
            'Akun berhasil dibuat dengan role Pengawas. Cek inbox email Anda untuk verifikasi, lalu tunggu persetujuan Admin sebelum menggunakan aplikasi.'
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
          <div className="flex items-center gap-3.5">
            <BrandLogo size={38} variant="light" />
            <div className="min-w-0">
              <p className="text-[11px] font-mono tracking-wider text-slate-300 uppercase">
                Shift Handover Log
              </p>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight">
                MILITARY &amp; STABILITY
              </h1>
            </div>
          </div>
          <p className="mt-2.5 text-xs text-slate-200 leading-relaxed">
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

          <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                {tab === 'login' ? 'Masuk Akun' : 'Registrasi Akun'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {tab === 'login'
                  ? 'Gunakan akun Google atau email terdaftar.'
                  : 'Isi data akun baru untuk mulai mencatat.'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
                  setInfoMsg(null);
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
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
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all whitespace-nowrap ${
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

          {/* Google OAuth Login & Registration */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleLoading || loading}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2.5 shadow-sm hover:shadow-md active:scale-[0.98] transition-all"
            >
              <GoogleIcon />
              <span>
                {googleLoading
                  ? 'Menghubungkan ke Google...'
                  : tab === 'login'
                    ? 'Masuk dengan Google'
                    : 'Daftar dengan Google'}
              </span>
            </button>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink mx-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
                atau dengan email
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>
          </div>

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
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="auth-password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Kata Sandi
                </label>
                {tab === 'login' && (
                  <button
                    type="button"
                    disabled={resettingPassword || loading || googleLoading}
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-[#0F294A] hover:text-[#163864] hover:underline disabled:opacity-50"
                  >
                    {resettingPassword ? 'Mengirim...' : 'Lupa kata sandi?'}
                  </button>
                )}
              </div>
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

            {tab === 'register' && (
              <p className="text-xs text-slate-500 leading-relaxed">
                Akun baru (email maupun Google) otomatis terdaftar dengan role default{' '}
                <strong className="text-slate-700">Pengawas</strong> dan menunggu konfirmasi{' '}
                <strong className="text-slate-700">Admin</strong> sebelum dapat mengakses data.
              </p>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-full bg-[#0F294A] hover:bg-[#163864] disabled:opacity-50 text-white text-sm font-semibold shadow-md shadow-[#0F294A]/25 hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 transition-all"
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
