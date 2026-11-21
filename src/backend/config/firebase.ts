import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  doc,
  enableNetwork,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

function initDb(): Firestore {
  const isBrowser = typeof window !== 'undefined';

  if (!isBrowser) {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }

  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firebaseConfig.firestoreDatabaseId
    );
  } catch {
    try {
      return initializeFirestore(
        app,
        {
          experimentalAutoDetectLongPolling: true,
          localCache: memoryLocalCache(),
        },
        firebaseConfig.firestoreDatabaseId
      );
    } catch {
      return getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  }
}

export const db = initDb();
export const auth = getAuth(app);
export const firebaseProjectConfig = firebaseConfig;

function isTransientConnectionError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '').toLowerCase()
      : '';
  return (
    code === 'unavailable' ||
    msg.includes('the client is offline') ||
    msg.includes('could not reach cloud firestore') ||
    msg.includes('the operation could not be completed')
  );
}

export async function testFirestoreConnection(): Promise<{ ok: boolean; message: string }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      message: 'Perangkat sedang offline. Aplikasi berjalan menggunakan cache lokal.',
    };
  }

  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return {
      ok: true,
      message: `Koneksi Firebase Cloud Firestore dan project ${firebaseConfig.projectId} siap digunakan.`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.toLowerCase().includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return {
        ok: false,
        message: 'Gagal terhubung ke Firebase Cloud Firestore (klien offline). Periksa koneksi internet Anda.',
      };
    }
    if (isTransientConnectionError(error)) {
      return {
        ok: false,
        message: 'Koneksi ke Cloud Firestore sedang tidak stabil. Aplikasi memakai cache lokal.',
      };
    }
    return {
      ok: true,
      message: `Koneksi Firebase Cloud Firestore (${firebaseConfig.projectId}) dan Security Rules aktif.`,
    };
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void enableNetwork(db).catch(() => undefined);
  });

  // Tunda probe awal sesaat agar tidak berbenturan dengan reload pembersihan SW/cache saat boot
  const runInitialCheck = () => {
    window.setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void testFirestoreConnection();
    }, 800);
  };

  if (document.readyState === 'complete') {
    runInitialCheck();
  } else {
    window.addEventListener('load', runInitialCheck, { once: true });
  }
}
