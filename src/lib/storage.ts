const DB_NAME = 'signdocu-storage';
const DB_VERSION = 1;
const STORE_NAME = 'key-value-pairs';
const LOCALSTORAGE_THRESHOLD = 10 * 1024; // 10KB — values larger than this go to IndexedDB

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/**
 * Get a value by key. Tries IndexedDB first, falls back to localStorage.
 */
export async function getItem<T = string>(key: string): Promise<T | null> {
  // Check localStorage first for small items
  const localValue = localStorage.getItem(`idx_${key}`);
  if (localValue !== null) {
    try {
      return JSON.parse(localValue) as T;
    } catch {
      return localValue as unknown as T;
    }
  }

  // Try IndexedDB
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Set a value by key. Uses IndexedDB for large values, localStorage for small ones.
 */
export async function setItem(key: string, value: unknown): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const size = new Blob([serialized]).size;

  // Use localStorage for small values
  if (size <= LOCALSTORAGE_THRESHOLD && typeof value === 'object') {
    try {
      localStorage.setItem(`idx_${key}`, serialized);
      // Also try to remove from IndexedDB if it was there before
      try {
        const db = await getDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
      } catch { /* ignore */ }
      return;
    } catch {
      // localStorage failed (full), fall through to IndexedDB
    }
  }

  // Use IndexedDB for large values
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(serialized, key);
      tx.oncomplete = () => {
        // Also remove from localStorage if it was there
        localStorage.removeItem(`idx_${key}`);
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB failed (e.g. private browsing Safari) — fall back to localStorage
    try {
      localStorage.setItem(`idx_${key}`, serialized);
    } catch {
      // Both failed, silently ignore
    }
  }
}

/**
 * Remove a value by key from both stores.
 */
export async function removeItem(key: string): Promise<void> {
  localStorage.removeItem(`idx_${key}`);
  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

/**
 * Get all keys that match a prefix from both stores.
 */
export async function getKeysByPrefix(prefix: string): Promise<string[]> {
  const keys = new Set<string>();

  // From IndexedDB
  try {
    const db = await getDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = () => {
        (request.result as string[]).forEach(k => {
          if (k.startsWith(prefix)) keys.add(k);
        });
        resolve();
      };
      request.onerror = () => resolve();
    });
  } catch { /* ignore */ }

  // From localStorage
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(`idx_${prefix}`)) {
      keys.add(k.slice(4)); // Remove 'idx_' prefix
    }
  }

  return Array.from(keys);
}

/**
 * Clear all values from both stores that match a prefix.
 */
export async function clearPrefix(prefix: string): Promise<void> {
  const keys = await getKeysByPrefix(prefix);
  await Promise.all(keys.map(k => removeItem(k)));
}
