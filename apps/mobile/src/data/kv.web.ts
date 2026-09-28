/** IndexedDB key-value store for the web build (localStorage fallback). */
const DB_NAME = 'gymolingo';
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const hasIdb = typeof indexedDB !== 'undefined';

export const kv = {
  async get(key: string): Promise<string | null> {
    if (!hasIdb) return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    const v = await tx<string | undefined>('readonly', (s) => s.get(key) as IDBRequest<string | undefined>);
    return v ?? null;
  },
  async set(key: string, value: string): Promise<void> {
    if (!hasIdb) {
      localStorage.setItem(key, value);
      return;
    }
    await tx('readwrite', (s) => s.put(value, key));
  },
  async remove(key: string): Promise<void> {
    if (!hasIdb) {
      localStorage.removeItem(key);
      return;
    }
    await tx('readwrite', (s) => s.delete(key));
  },
  async clear(prefix: string): Promise<void> {
    if (!hasIdb) {
      Object.keys(localStorage)
        .filter((k) => k.startsWith(prefix))
        .forEach((k) => localStorage.removeItem(k));
      return;
    }
    const keys = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
    await Promise.all(keys.map(String).filter((k) => k.startsWith(prefix)).map((k) => tx('readwrite', (s) => s.delete(k))));
  },
};
