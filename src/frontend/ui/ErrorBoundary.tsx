import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan pada antarmuka aplikasi.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('UI Render Error:', error, errorInfo);
  }

  handleRecover = async () => {
    try {
      const win = window as unknown as { __msPurgePwaCaches?: () => Promise<unknown> };
      if (typeof win.__msPurgePwaCaches === 'function') {
        await win.__msPurgePwaCaches();
      } else {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.allSettled(regs.map((reg) => reg.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.allSettled(keys.map((k) => caches.delete(k)));
        }
      }
      sessionStorage.removeItem('ms_sw_purged_v1');
      sessionStorage.removeItem('ms_sw_purged_v2');
    } catch {
      // Abaikan jika pembersihan storage gagal
    }
    window.location.replace(`${window.location.pathname}?_fresh=${Date.now()}`);
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0F1115] text-slate-900 dark:text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161920] p-6 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <p className="text-xs font-mono font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Pemulihan Aplikasi
            </p>
            <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">
              Tampilan gagal dimuat
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Aplikasi mengalami gangguan saat merender halaman. Klik tombol di bawah untuk
              membersihkan cache lama dan memuat ulang halaman.
            </p>
          </div>

          {this.state.errorMessage && (
            <pre className="p-3 rounded-xl bg-slate-100 dark:bg-[#11141A] border border-slate-200 dark:border-zinc-800 text-[11px] font-mono text-slate-700 dark:text-zinc-300 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
              {this.state.errorMessage}
            </pre>
          )}

          <button
            type="button"
            onClick={this.handleRecover}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-700 dark:hover:bg-teal-600 text-white text-sm font-semibold shadow-sm transition-all"
          >
            Muat Ulang &amp; Bersihkan Cache
          </button>
        </div>
      </div>
    );
  }
}
