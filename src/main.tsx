import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

declare global {
  interface Window {
    __appBooted?: boolean;
  }
}

async function recoverFromStaleChunk(): Promise<void> {
  try {
    if (window.sessionStorage.getItem('ms_chunk_reload_v1')) {
      return;
    }
    window.sessionStorage.setItem('ms_chunk_reload_v1', '1');
  } catch {
    // ignore storage errors
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((reg) => reg.unregister().catch(() => false)));
    }
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key).catch(() => false)));
    }
  } catch {
    // ignore cleanup errors
  }

  window.location.reload();
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  void recoverFromStaleChunk();
});

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      registration.update().catch(() => undefined);
    }
  },
});

const rootEl = document.getElementById('root');
if (rootEl) {
  window.__appBooted = true;
  try {
    window.sessionStorage.removeItem('ms_chunk_reload_v1');
  } catch {
    // ignore storage errors
  }
  createRoot(rootEl).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
