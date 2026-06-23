import { Capacitor } from '@capacitor/core';
import { getItem, setItem, removeItem, getKeysByPrefix } from './storage';

const CACHE_NAME = 'draw-sign-pro-docs';
const CACHE_MAX_ITEMS = 5;
const LAST_DOCS_KEY = 'draw-sign-pro-last-docs';
const SIG_PREFIX = 'draw-sign-pro-cached-sig';

interface CachedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  cachedAt: number;
  cacheKey: string;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnlineChange(callback: (online: boolean) => void): () => void {
  const handler = () => callback(navigator.onLine);
  window.addEventListener('online', handler);
  window.addEventListener('offline', handler);
  return () => {
    window.removeEventListener('online', handler);
    window.removeEventListener('offline', handler);
  };
}

function getLastDocs(): CachedDocument[] {
  try {
    const data = localStorage.getItem(LAST_DOCS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function persistLastDocs(docs: CachedDocument[]): void {
  try {
    localStorage.setItem(LAST_DOCS_KEY, JSON.stringify(docs));
  } catch {
    // Storage full - remove oldest
  }
}

export async function cacheDocument(file: File): Promise<void> {
  if (!('caches' in window)) return;

  const docs = getLastDocs();
  const id = `doc-${Date.now()}`;
  const cacheKey = `/offline-doc/${id}/${file.name}`;

  const cache = await caches.open(CACHE_NAME);
  const response = new Response(file, {
    headers: {
      'Content-Type': file.type,
      'Content-Length': String(file.size),
      'X-Cache-Date': String(Date.now()),
    },
  });
  await cache.put(cacheKey, response);

  docs.unshift({ id, name: file.name, type: file.type, size: file.size, cachedAt: Date.now(), cacheKey });
  while (docs.length > CACHE_MAX_ITEMS) {
    const removed = docs.pop();
    if (removed) cache.delete(removed.cacheKey);
  }
  persistLastDocs(docs);
}

export async function getCachedDocument(docId: string): Promise<{ file: File; name: string } | null> {
  if (!('caches' in window)) return null;

  const docs = getLastDocs();
  const doc = docs.find(d => d.id === docId);
  if (!doc) return null;

  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(doc.cacheKey);
  if (!response) return null;

  const blob = await response.blob();
  const file = new File([blob], doc.name, { type: doc.type });
  return { file, name: doc.name };
}

export function getCachedDocuments(): CachedDocument[] {
  return getLastDocs();
}

/**
 * Cache signatures to IndexedDB (handles large base64 data URLs).
 */
export async function cacheSignatures(signatures: Array<{ id: string; dataUrl: string; label: string }>): Promise<void> {
  try {
    // Clear old cached sigs
    const oldKeys = await getKeysByPrefix(SIG_PREFIX);
    await Promise.all(oldKeys.map(k => removeItem(k)));

    // Store each signature individually
    await Promise.all(signatures.map(s =>
      setItem(`${SIG_PREFIX}_${s.id}`, { id: s.id, label: s.label, dataUrl: s.dataUrl })
    ));
  } catch {
    // Storage failed
  }
}

/**
 * Get cached signatures from IndexedDB.
 */
export async function getCachedSignatures(): Promise<{ id: string; dataUrl: string; label: string }[]> {
  try {
    const keys = await getKeysByPrefix(SIG_PREFIX);
    const sigs = await Promise.all(keys.map(k => getItem<{ id: string; dataUrl: string; label: string }>(k)));
    return sigs.filter(Boolean) as { id: string; dataUrl: string; label: string }[];
  } catch {
    return [];
  }
}

export async function clearOfflineCache(): Promise<void> {
  if ('caches' in window) {
    await caches.delete(CACHE_NAME);
  }
  localStorage.removeItem(LAST_DOCS_KEY);
  // Clear IndexedDB cached signatures
  const sigKeys = await getKeysByPrefix(SIG_PREFIX);
  await Promise.all(sigKeys.map(k => removeItem(k)));
}

export async function getCacheInfo(): Promise<{ docs: number; sigs: number }> {
  const sigKeys = await getKeysByPrefix(SIG_PREFIX);
  return {
    docs: getLastDocs().length,
    sigs: sigKeys.length,
  };
}
