import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 dark:bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-500/20"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Offline — Menggunakan data tersimpan.</span>
    </div>
  );
}
