import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { signOutFirebase } from '../services/handoverService';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  clearingCache: boolean;
  signingOut: boolean;
}

async function clearAppCachesAndServiceWorkers(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
    }
  } catch {
    // ignore SW unregister errors
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name).catch(() => false)));
    }
  } catch {
    // ignore CacheStorage errors
  }

  try {
    window.localStorage.removeItem('ms_user_profile_cache_v1');
    window.sessionStorage.removeItem('ms_chunk_reload_v1');
  } catch {
    // ignore storage errors
  }
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      clearingCache: false,
      signingOut: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan internal pada aplikasi.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('App ErrorBoundary caught error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = async () => {
    this.setState({ clearingCache: true });
    await clearAppCachesAndServiceWorkers();
    window.location.reload();
  };

  private handleSignOutAndReload = async () => {
    this.setState({ signingOut: true });
    try {
      await signOutFirebase();
    } catch {
      // ignore sign-out failure
    }
    await clearAppCachesAndServiceWorkers();
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { errorMessage, clearingCache, signingOut } = this.state;

    return (
      <div
        role="alert"
        className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4 sm:p-6"
      >
        <div className="max-w-md w-full bg-white dark:bg-[#0B0C0E] rounded-2xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm space-y-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100">
                Terjadi Gangguan Tampilan
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                Aplikasi mengalami error saat memuat halaman setelah login. Anda dapat memuat ulang halaman atau membersihkan cache aplikasi.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#121417] border border-slate-200 dark:border-zinc-800">
              <p className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 mb-1">
                Detail Error:
              </p>
              <p className="text-xs font-mono text-rose-700 dark:text-rose-300 break-words">
                {errorMessage}
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={this.handleReload}
              disabled={clearingCache || signingOut}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400 disabled:opacity-50 text-white dark:text-zinc-950 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Halaman</span>
            </button>

            <button
              type="button"
              onClick={this.handleClearCacheAndReload}
              disabled={clearingCache || signingOut}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-[#16191F] hover:bg-slate-50 dark:hover:bg-[#1E222A] disabled:opacity-50 text-slate-800 dark:text-zinc-200 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{clearingCache ? 'Membersihkan Cache...' : 'Bersihkan Cache & Muat Ulang'}</span>
            </button>

            <button
              type="button"
              onClick={this.handleSignOutAndReload}
              disabled={clearingCache || signingOut}
              className="w-full min-h-[42px] px-5 py-2 rounded-full border border-rose-200 dark:border-rose-900/70 bg-rose-50 dark:bg-rose-950/45 hover:bg-rose-100 dark:hover:bg-rose-950/80 disabled:opacity-50 text-rose-700 dark:text-rose-300 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>{signingOut ? 'Keluar...' : 'Keluar Akun & Kembali ke Login'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
