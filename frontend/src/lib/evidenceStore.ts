/**
 * High-Capacity IndexedDB Evidence Storage
 * Stores large binary blobs, video clips, photo bursts, and audio recordings
 * without hitting localStorage 5MB browser quota limits.
 */

const DB_NAME = 'SilentSOSEvidenceDB';
const DB_VERSION = 1;
const STORE_NAME = 'evidence_records';

export interface StoredEvidence {
  alertId: string;
  photoDataUrl?: string;
  photoDataUrls?: string[];
  videoDataUrl?: string;
  audioDataUrl?: string;
  updatedAt: number;
}

// In-memory cache for instant zero-latency access
const memoryCache = new Map<string, StoredEvidence>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'alertId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveEvidenceToDb(evidence: Partial<StoredEvidence> & { alertId: string }): Promise<void> {
  if (!evidence.alertId) return;
  const existing = memoryCache.get(evidence.alertId) || (await getEvidenceFromDb(evidence.alertId)) || ({} as StoredEvidence);
  const merged: StoredEvidence = {
    alertId: evidence.alertId,
    photoDataUrl: evidence.photoDataUrl || existing.photoDataUrl,
    photoDataUrls: (evidence.photoDataUrls && evidence.photoDataUrls.length > 0) ? evidence.photoDataUrls : existing.photoDataUrls,
    videoDataUrl: evidence.videoDataUrl || existing.videoDataUrl,
    audioDataUrl: evidence.audioDataUrl || existing.audioDataUrl,
    updatedAt: Date.now()
  };
  memoryCache.set(evidence.alertId, merged);
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(merged);
  } catch (err) {
    console.debug('Evidence IndexedDB store notice:', err);
  }
}

export async function getEvidenceFromDb(alertId: string): Promise<StoredEvidence | null> {
  if (!alertId) return null;
  if (memoryCache.has(alertId)) {
    return memoryCache.get(alertId)!;
  }
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(alertId);
      req.onsuccess = () => {
        if (req.result) {
          memoryCache.set(alertId, req.result);
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteEvidenceFromDb(alertId: string): Promise<void> {
  if (!alertId) return;
  memoryCache.delete(alertId);
  try {
    const db = await openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(alertId);
  } catch {}
}
