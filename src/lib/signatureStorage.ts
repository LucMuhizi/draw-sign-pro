import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { getItem, setItem, removeItem, getKeysByPrefix } from './storage';
import { toast } from 'sonner';

export interface SavedSignature {
  id: string;
  label: string;
  dataUrl: string;
  createdAt: number;
  isDefault?: boolean;
}

const STORAGE_KEY_PREFIX = 'draw-sign-pro-signatures';

async function getSignatures(): Promise<SavedSignature[]> {
  try {
    const keys = await getKeysByPrefix(STORAGE_KEY_PREFIX);
    const sigs: SavedSignature[] = [];
    for (const key of keys) {
      const sig = await getItem<SavedSignature>(key);
      if (sig) sigs.push(sig);
    }
    return sigs.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

async function persistSignatures(sigs: SavedSignature[]): Promise<void> {
  // Get old keys and clear them
  const oldKeys = await getKeysByPrefix(STORAGE_KEY_PREFIX);
  const newKeySet = new Set(sigs.map(s => `${STORAGE_KEY_PREFIX}_${s.id}`));
  for (const key of oldKeys) {
    if (!newKeySet.has(key)) {
      await removeItem(key);
    }
  }
  // Save all
  await Promise.all(sigs.map(s => setItem(`${STORAGE_KEY_PREFIX}_${s.id}`, s)));
}

export function useSignatures() {
  const [signatures, setSignatures] = useState<SavedSignature[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getSignatures().then(sigs => {
      setSignatures(sigs);
      setLoaded(true);
    });
  }, []);

  const addSignature = useCallback(async (dataUrl: string, label: string): Promise<SavedSignature> => {
    const newSig: SavedSignature = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      label,
      dataUrl,
      createdAt: Date.now(),
    };
    const current = await getSignatures();
    const updated = [...current, newSig];
    await persistSignatures(updated);
    setSignatures(updated);
    return newSig;
  }, []);

  const deleteSignature = useCallback(async (id: string) => {
    const updated = (await getSignatures()).filter(s => s.id !== id);
    await persistSignatures(updated);
    setSignatures(updated);
  }, []);

  const replaceAll = useCallback(async (sigs: SavedSignature[]) => {
    await persistSignatures(sigs);
    setSignatures(sigs);
  }, []);

  return { signatures, loaded, addSignature, deleteSignature, replaceAll };
}

export async function syncLocalToCloud(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const local = await getSignatures();
  if (local.length === 0) return;

  const { data: existing } = await supabase
    .from('signatures')
    .select('id, data_url')
    .eq('user_id', userId);

  const existingUrls = new Set((existing ?? []).map((r: { data_url: string }) => r.data_url));
  const newSigs = local.filter(s => !existingUrls.has(s.dataUrl));

  if (newSigs.length === 0) return;

  const { error } = await supabase.from('signatures').insert(
    newSigs.map(s => ({
      user_id: userId,
      label: s.label,
      data_url: s.dataUrl,
      created_at: new Date(s.createdAt).toISOString(),
    }))
  );

  if (error) toast.error('Failed to sync signatures to cloud');
}

export async function fetchCloudSignatures(userId: string): Promise<SavedSignature[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('signatures')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    toast.error('Failed to fetch cloud signatures');
    return [];
  }

  return ((data ?? []) as { id: string; label: string; data_url: string; created_at: string }[]).map(r => ({
    id: r.id ?? Date.now().toString(36),
    label: r.label ?? '',
    dataUrl: r.data_url,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}
