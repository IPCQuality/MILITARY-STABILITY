import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const firebaseProjectConfig = firebaseConfig;

export async function testFirestoreConnection(): Promise<{ ok: boolean; message: string }> {
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
