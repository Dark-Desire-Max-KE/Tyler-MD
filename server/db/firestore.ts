import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  limit,
  getDocs,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

// Load config safely
const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error('Failed to parse firebase-applet-config.json:', err);
  }
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface BotSessionRecord {
  sessionId: string;
  phoneNumber: string;
  pairingCode?: string;
  status: 'pending' | 'paired' | 'active' | 'disconnected';
  sessionCreds?: string;
  createdAt: string;
  pairedAt?: string;
  devicePlatform?: string;
}

/**
 * Save new pairing session to Firestore database
 */
export async function saveBotSessionToDb(session: BotSessionRecord): Promise<void> {
  try {
    const docRef = doc(firestoreDb, 'bot_sessions', session.sessionId);
    await setDoc(docRef, {
      ...session,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Update global pairing stats
    const statsRef = doc(firestoreDb, 'system_stats', 'global');
    await setDoc(statsRef, {
      lastUpdated: new Date().toISOString(),
      activeSockets: 1
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to save session to DB (fallback to local memory):', err);
  }
}

/**
 * Mark session as successfully paired and increment total paired metric
 */
export async function markSessionPairedInDb(sessionId: string, credsBase64: string): Promise<void> {
  try {
    const docRef = doc(firestoreDb, 'bot_sessions', sessionId);
    await updateDoc(docRef, {
      status: 'paired',
      sessionCreds: credsBase64,
      pairedAt: new Date().toISOString()
    });

    const statsRef = doc(firestoreDb, 'system_stats', 'global');
    await setDoc(statsRef, {
      totalPaired: increment(1),
      lastUpdated: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to mark session paired in DB:', err);
  }
}

/**
 * Retrieve recent paired bot sessions for Admin view
 */
export async function getRecentBotSessionsFromDb(limitCount = 50): Promise<BotSessionRecord[]> {
  try {
    const colRef = collection(firestoreDb, 'bot_sessions');
    const q = query(colRef, limit(limitCount));
    const snap = await getDocs(q);
    const sessions: BotSessionRecord[] = [];
    snap.forEach((d) => {
      sessions.push(d.data() as BotSessionRecord);
    });
    return sessions;
  } catch (err) {
    console.warn('[Firestore] Failed to retrieve sessions:', err);
    return [];
  }
}

/**
 * Get total paired sessions count
 */
export async function getPairedBotCountFromDb(): Promise<{ totalPaired: number; activeSessions: number }> {
  try {
    const statsRef = doc(firestoreDb, 'system_stats', 'global');
    const snap = await getDoc(statsRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        totalPaired: data.totalPaired || 1,
        activeSessions: data.activeSockets || 1
      };
    }
  } catch (err) {
    // Return baseline if offline
  }
  return { totalPaired: 1, activeSessions: 1 };
}
