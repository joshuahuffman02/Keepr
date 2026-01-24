/**
 * Lightweight offline queue persistence with IndexedDB fallback to localStorage.
 * API is intentionally small and synchronous-friendly for existing callers.
 */
const DB_NAME = "campreserv-offline";
const STORE = "queues";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const hasSyncRegister = (value: unknown): value is { register: (tag: string) => Promise<void> } =>
  isRecord(value) && typeof value.register === "function";

function hasIndexedDb() {
  return typeof indexedDB !== "undefined";
}

export async function registerBackgroundSync(tag = "sync-queues") {
  if (typeof window === "undefined") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && "sync" in reg) {
      const maybeSync = reg.sync;
      if (hasSyncRegister(maybeSync)) {
        await maybeSync.register(tag);
      }
    }
  } catch {
    // background sync not available; ignore
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown) {
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    return new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // swallow; caller will have written to localStorage already
  }
}

export function loadQueue<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQueue<T>(key: string, items: T[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // ignore localStorage write issues
  }
  if (hasIndexedDb()) {
    void idbSet(key, items);
  }
}

const OFFLINE_ACTIONS_KEY = "campreserv:pwa:offlineActions";

export type OfflineAction = {
  id: string;
  type: string;
  payload: unknown;
  endpoint: string;
  method: string;
  body?: unknown;
  createdAt: string;
};

export async function queueOfflineAction(action: Omit<OfflineAction, "id" | "createdAt">) {
  const queue = loadQueue<OfflineAction>(OFFLINE_ACTIONS_KEY);
  const newAction: OfflineAction = {
    ...action,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  queue.push(newAction);
  saveQueue(OFFLINE_ACTIONS_KEY, queue);
  await registerBackgroundSync("sync-offline-actions");
  return newAction;
}

export function getOfflineActions(): OfflineAction[] {
  return loadQueue<OfflineAction>(OFFLINE_ACTIONS_KEY);
}

export function clearOfflineAction(id: string) {
  const queue = loadQueue<OfflineAction>(OFFLINE_ACTIONS_KEY);
  const filtered = queue.filter((a) => a.id !== id);
  saveQueue(OFFLINE_ACTIONS_KEY, filtered);
}
