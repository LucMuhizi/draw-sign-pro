import { Capacitor } from '@capacitor/core';

const QUEUE_KEY = 'draw-sign-pro-sync-queue';

/** Minimum delay between retries (ms) */
const BASE_DELAY = 1000;
/** Maximum delay between retries (ms) */
const MAX_DELAY = 5 * 60 * 1000; // 5 minutes

interface SyncAction {
  id: string;
  type: 'saveDocument' | 'uploadStorage' | 'syncSignature' | 'createRecord';
  payload: Record<string, unknown>;
  createdAt: number;
  retries: number;
}

export function getQueue(): SyncAction[] {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function persistQueue(queue: SyncAction[]): void {
  try {
    while (queue.length > 50) {
      const dropped = queue.shift();
      if (dropped) console.warn('Sync queue full — dropped action:', dropped.type, dropped.id);
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full
  }
}

export function enqueueAction(type: SyncAction['type'], payload: Record<string, unknown>): void {
  const queue = getQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    payload,
    createdAt: Date.now(),
    retries: 0,
  });
  persistQueue(queue);
}

export function dequeueAction(id: string): void {
  const queue = getQueue().filter(a => a.id !== id);
  persistQueue(queue);
}

export function incrementRetry(id: string): void {
  const queue = getQueue().map(a => (a.id === id ? { ...a, retries: a.retries + 1 } : a));
  persistQueue(queue);
}

// ─── Exponential backoff scheduling ──────────────────────────────────

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let currentDelay = BASE_DELAY;
let onlineHandler: (() => void) | null = null;
let running = false;

async function processQueue(processor: (action: SyncAction) => Promise<boolean>): Promise<boolean> {
  if (!navigator.onLine) return false;

  const queue = getQueue();
  let hadSuccess = false;

  for (const action of queue) {
    if (action.retries >= 5) {
      dequeueAction(action.id); // Expired after 5 retries
      continue;
    }
    try {
      const success = await processor(action);
      if (success) {
        dequeueAction(action.id);
        hadSuccess = true;
      } else {
        incrementRetry(action.id);
      }
    } catch {
      incrementRetry(action.id);
    }
  }

  return hadSuccess;
}

function scheduleNext(processor: (action: SyncAction) => Promise<boolean>) {
  if (!running) return;

  const delay = currentDelay;

  activeTimer = setTimeout(async () => {
    try {
      const hadSuccess = await processQueue(processor);
      // On success, reset delay; on failure, double it
      if (hadSuccess) {
        currentDelay = BASE_DELAY;
      } else {
        currentDelay = Math.min(currentDelay * 2, MAX_DELAY);
      }
    } catch {
      currentDelay = Math.min(currentDelay * 2, MAX_DELAY);
    }
    scheduleNext(processor);
  }, delay);
}

export function startBackgroundSync(processor: (action: SyncAction) => Promise<boolean>): void {
  stopBackgroundSync();
  running = true;

  const handleOnline = async () => {
    currentDelay = BASE_DELAY; // Reset on reconnect
    await processQueue(processor);
  };
  onlineHandler = handleOnline;
  window.addEventListener('online', handleOnline);

  // Process immediately on startup, then schedule
  processQueue(processor).then(() => {
    currentDelay = BASE_DELAY;
    scheduleNext(processor);
  });
}

export function stopBackgroundSync(): void {
  running = false;
  if (activeTimer) {
    clearTimeout(activeTimer);
    activeTimer = null;
  }
  if (onlineHandler) {
    window.removeEventListener('online', onlineHandler);
    onlineHandler = null;
  }
}

export function getQueueLength(): number {
  return getQueue().filter(a => a.retries < 5).length;
}
