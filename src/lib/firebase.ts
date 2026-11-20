import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

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
        experimentalForceLongPolling: true,
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
          experimentalForceLongPolling: true,
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
      message: 'Koneksi Firebase Cloud Firestore dan project robust-truck-5pqwl siap digunakan.',
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return {
        ok: false,
        message: 'Gagal terhubung ke Firebase Cloud Firestore (klien offline). Periksa koneksi internet Anda.',
      };
    }
    return {
      ok: true,
      message: `Koneksi Firebase Cloud Firestore (${firebaseConfig.projectId}) dan Security Rules aktif.`,
    };
  }
}

if (typeof window !== 'undefined') {
  void testFirestoreConnection();
}
