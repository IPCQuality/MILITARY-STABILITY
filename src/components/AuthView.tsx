import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Lock, LogIn, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { SHIFTS, type ShiftType, type UserProfile } from '../types/handover';
import { DEMO_ACCOUNTS } from '../utils/demoSeed';
import {
  DEFAULT_SUPABASE_URL,
  getStoredSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseConfig,
  signInDemoAccount,
  signInSupabase,
  signUpSupabase,
  testSupabaseConnection,
} from '../services/handoverService';

interface AuthViewProps {
  onAuthenticated: (user: UserProfile, mode: 'supabase' | 'demo') => void;
  sessionNotice?: string | null;
}

export function AuthView({ onAuthenticated, sessionNotice }: AuthViewProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [defaultShift, setDefaultShift] = useState<ShiftType>('Shift 1');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const [showConfig, setShowConfig] = useState(!isSupabaseConfigured());
  const initialCfg = getStoredSupabaseConfig();
  const [sbUrl, setSbUrl] = useState(initialCfg.url || DEFAULT_SUPABASE_URL);
  const [sbKey, setSbKey] = useState(initialCfg.publishableKey);
  const [cfgStatus, setCfgStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [supabaseReady, setSupabaseReady] = useState(isSupabaseConfigured());

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
        onAuthenticated(res.user, 'supabase');
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
          defaultShift,
        });
        if (res.error) {
          setErrorMsg(res.error);
          return;
        }
        if (res.needsEmailConfirm) {
          setInfoMsg(
            'Akun berhasil dibuat. Periksa email Anda untuk konfirmasi sebelum login.'
          );
          setTab('login');
          return;
        }
        if (res.user) {
          onAuthenticated(res.user, 'supabase');
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(e: FormEvent) {
    e.preventDefault();
    setCfgStatus(null);
    const saved = saveSupabaseConfig({ url: sbUrl, publishableKey: sbKey });
    if (!saved.ok) {
      setCfgStatus({ ok: false, text: saved.error || 'Konfigurasi tidak valid.' });
      return;
    }
    const configured = isSupabaseConfigured();
    setSupabaseReady(configured);
    if (!configured) {
      setCfgStatus({
        ok: false,
        text: 'Publishable Key dikosongkan. Gunakan Mode Demo atau masukkan key Supabase.',
      });
      return;
    }
    const ping = await testSupabaseConnection();
    setCfgStatus({ ok: ping.ok, text: ping.message });
  }

  function handleDemoLogin(accountEmail: string) {
    const profile = signInDemoAccount(accountEmail);
    onAuthenticated(profile, 'demo');
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Product Context & Demo Multiuser Access */}
        <div className="lg:col-span-5 bg-[#0F294A] text-white rounded-xl border border-slate-800 p-6 sm:p-8 flex flex-col justify-between gap-6 h-full">
          <div>
            <p className="text-xs font-mono tracking-wider text-slate-300 uppercase">
              Production Operations Log
            </p>
            <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              MILITARY &amp; STABILITY
            </h1>
            <p className="mt-3 text-sm text-slate-200 leading-relaxed">
              Sistem serah terima laporan pekerjaan antar-shift (Shift 1, Shift 2, dan Shift 3)
              dengan sinkronisasi Supabase Cloud dan ekspor Excel terstruktur.
            </p>
          </div>

          <div className="border-t border-white/15 pt-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Users className="w-4 h-4 shrink-0" />
              <span>Akses Cepat Simulasi Multiuser (Tanpa Setup)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Uji alur lintas shift secara langsung jika Publishable Key Supabase belum dimasukkan:
            </p>
            <div className="space-y-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleDemoLogin(acc.email)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-left rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 transition-colors flex items-center justify-between gap-2 text-xs font-medium"
                >
                  <span className="truncate">{acc.label}</span>
                  <span className="font-mono text-[11px] text-slate-300 shrink-0">
                    {acc.profile.defaultShift}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Supabase Auth Form & Key Configuration */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 sm:p-8 space-y-6">
          {sessionNotice && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm"
            >
              {sessionNotice}
            </div>
          )}

          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {tab === 'login' ? 'Masuk Akun Supabase' : 'Registrasi Akun Operator'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {supabaseReady
                  ? 'Terhubung ke Supabase Cloud'
                  : 'Publishable Key belum diisi — atur di bawah atau pilih akun demo'}
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setErrorMsg(null);
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    placeholder="Contoh: Budi Santoso"
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="auth-shift"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Shift Utama
                  </label>
                  <select
                    id="auth-shift"
                    value={defaultShift}
                    onChange={(e) => setDefaultShift(e.target.value as ShiftType)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F294A]"
                  >
                    {SHIFTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
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
                placeholder="operator@perusahaan.co.id"
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

          {/* Collapsible Supabase Publishable Key Configuration */}
          <div className="border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={() => setShowConfig((prev) => !prev)}
              className="flex items-center justify-between w-full text-left text-xs font-medium text-slate-700 hover:text-slate-900 py-1"
            >
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-[#0F294A]" />
                Konfigurasi Koneksi Supabase (Publishable Key)
              </span>
              <span className="text-slate-500">{showConfig ? 'Tutup' : 'Buka'}</span>
            </button>

            {showConfig && (
              <form onSubmit={handleSaveConfig} className="mt-3 space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <label
                    htmlFor="cfg-sb-url"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Supabase Project URL
                  </label>
                  <input
                    id="cfg-sb-url"
                    type="url"
                    value={sbUrl}
                    onChange={(e) => setSbUrl(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-md bg-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cfg-sb-key"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Publishable Key / Anon Public Key
                  </label>
                  <input
                    id="cfg-sb-key"
                    type="text"
                    value={sbKey}
                    onChange={(e) => setSbKey(e.target.value)}
                    placeholder="sb_publishable_... atau eyJ..."
                    className="w-full min-h-[40px] px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-md bg-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    <Lock className="w-3 h-3 shrink-0" />
                    Jangan pernah memasukkan service_role / secret key di browser.
                  </p>
                </div>

                {cfgStatus && (
                  <p
                    className={`text-xs p-2.5 rounded border ${
                      cfgStatus.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    {cfgStatus.text}
                  </p>
                )}

                <button
                  type="submit"
                  className="min-h-[40px] px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Simpan &amp; Uji Koneksi Supabase
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
