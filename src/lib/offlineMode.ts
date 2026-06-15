import { Capacitor } from '@capacitor/core';

const CACHE_NAME = 'draw-sign-pro-docs';
const CACHE_MAX_ITEMS = 5;
const LAST_DOCS_KEY = 'draw-sign-pro-last-docs';
const LAST_SIGS_KEY = 'draw-sign-pro-last-sigs';

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

export function cacheSignatures(signatures: Array<{ id: string; dataUrl: string; label: string }>): void {
  try {
    const toCache = signatures.map(function(s) { return { id: s.id, label: s.label, dataUrl: s.dataUrl }; });
    localStorage.setItem(LAST_SIGS_KEY, JSON.stringify(toCache));
  } catch {
    // Storage full
  }
}

export function getCachedSignatures(): { id: string; dataUrl: string; label: string }[] {
  try {
    const data = localStorage.getItem(LAST_SIGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function clearOfflineCache(): Promise<void> {
  if ('caches' in window) {
    await caches.delete(CACHE_NAME);
  }
  localStorage.removeItem(LAST_DOCS_KEY);
  localStorage.removeItem(LAST_SIGS_KEY);
}

export function getCacheInfo(): { docs: number; sigs: number } {
  return {
    docs: getLastDocs().length,
    sigs: getCachedSignatures().length,
  };
}
