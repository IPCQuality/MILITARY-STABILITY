import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface PWAInstallButtonProps {
  variant?: 'header' | 'auth' | 'settings';
}

export function PWAInstallButton({ variant = 'header' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useBodyScrollLock(showGuide);

  useEffect(() => {
    if (!showGuide) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setShowGuide(false);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showGuide]);

  async function handleInstallClick() {
    if (isInstallable) {
      setInstalling(true);
      try {
        await install();
      } finally {
        setInstalling(false);
      }
      return;
    }
    setShowGuide(true);
  }

  // Pada header & halaman auth, sembunyikan otomatis jika sudah terpasang sebagai PWA standalone
  if (isInstalled && variant !== 'settings') {
    return null;
  }

  // Pada header, tampilkan hanya jika browser siap prompt install atau perangkat iOS
  if (variant === 'header' && !isInstallable && !isIOS) {
    return null;
  }

  const guideModal = showGuide ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/80 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-guide-title"
      onClick={() => setShowGuide(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0B0C0E] border border-slate-200 dark:border-zinc-800 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Ikon aplikasi Military & Stability"
              className="w-11 h-11 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0"
            />
            <div>
              <h3
                id="pwa-guide-title"
                className="text-sm font-bold text-slate-900 dark:text-zinc-100"
              >
                {isIOS ? 'Instal di iPhone / iPad' : 'Instal Aplikasi (PWA)'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                MILITARY &amp; STABILITY
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            aria-label="Tutup panduan instalasi"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-[#16191F] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isIOS ? (
          <ol className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Buka halaman ini di <strong>Safari</strong>, lalu ketuk tombol{' '}
                <strong className="inline-flex items-center gap-1">
                  <Share className="w-3.5 h-3.5 inline" /> Bagikan (Share)
                </strong>{' '}
                di bilah bawah.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama</strong>{' '}
                (Add to Home Screen).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>
                Ketuk <strong>Tambah</strong> — ikon HD aplikasi akan muncul di layar
                utama.
              </span>
            </li>
          </ol>
        ) : (
          <ol className="mt-4 space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </span>
              <span>
                Buka menu browser (ikon <strong>⋮</strong> di pojok kanan atas Chrome /
                Edge).
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </span>
              <span>
                Pilih <strong>Instal aplikasi</strong> atau{' '}
                <strong>Tambahkan ke layar utama</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </span>
              <span>
                Aplikasi dapat dibuka layar penuh langsung dari layar utama seperti
                aplikasi native.
              </span>
            </li>
          </ol>
        )}

        <button
          type="button"
          onClick={() => setShowGuide(false)}
          className="mt-5 w-full min-h-[42px] rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-zinc-950 text-sm font-semibold transition-colors"
        >
          Mengerti
        </button>
      </div>
    </div>
  ) : null;

  if (variant === 'settings') {
    return (
      <>
        <section className="bg-white dark:bg-[#0B0C0E] rounded-2xl border border-slate-200/90 dark:border-zinc-800/90 shadow-xs p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <img
                src="/pwa-192x192.png"
                alt="Ikon Aplikasi Military & Stability"
                className="w-11 h-11 rounded-xl border border-slate-200 dark:border-zinc-800 shrink-0 shadow-xs"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Aplikasi Web (PWA)
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  {isInstalled
                    ? 'Sudah terpasang dan berjalan dalam mode aplikasi.'
                    : 'Pasang di layar utama HP atau desktop untuk akses cepat.'}
                </p>
              </div>
            </div>

            {isInstalled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap shrink-0">
                <CheckCircle2 className="w-4 h-4" />
                Terpasang
              </span>
            ) : (
              <button
                type="button"
                onClick={handleInstallClick}
                disabled={installing}
                data-testid="pwa-install-settings-btn"
                className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-500 dark:hover:bg-teal-400 text-white dark:text-zinc-950 text-xs font-semibold shadow-xs active:scale-[0.98] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all disabled:opacity-60"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isInstallable ? 'Instal' : 'Cara Instal'}</span>
              </button>
            )}
          </div>
        </section>
        {guideModal}
      </>
    );
  }

  if (variant === 'auth') {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          disabled={installing}
          data-testid="pwa-install-auth-btn"
          className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl bg-white dark:bg-[#0B0C0E] hover:bg-slate-50 dark:hover:bg-[#14171C] border border-slate-200/90 dark:border-zinc-800/90 text-teal-700 dark:text-teal-400 text-xs sm:text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
        >
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>
            {isInstallable
              ? 'Instal Aplikasi ke Perangkat'
              : isIOS
                ? 'Cara Instal di Layar Utama (iOS)'
                : 'Instal Aplikasi (PWA)'}
          </span>
        </button>
        {guideModal}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        disabled={installing}
        data-testid="pwa-install-header-btn"
        aria-label="Instal aplikasi"
        title="Instal aplikasi ke perangkat"
        className="min-h-[34px] px-2.5 sm:px-3 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800/80 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 dark:hover:bg-teal-900/60 active:scale-[0.97] text-teal-800 dark:text-teal-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 disabled:opacity-60"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="hidden sm:inline">Instal</span>
      </button>
      {guideModal}
    </>
  );
}
