import { useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';

export interface SavedSignature {
  id: string;
  label: string;
  dataUrl: string;
  createdAt: number;
}

const STORAGE_KEY = 'draw-sign-pro-signatures';

function getSignatures(): SavedSignature[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function persistSignatures(sigs: SavedSignature[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sigs));
}

export function useSignatures() {
  const [signatures, setSignatures] = useState<SavedSignature[]>(() => getSignatures());

  const addSignature = useCallback((dataUrl: string, label: string): SavedSignature => {
    const newSig: SavedSignature = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      label,
      dataUrl,
      createdAt: Date.now(),
    };
    const updated = [...getSignatures(), newSig];
    persistSignatures(updated);
    setSignatures(updated);
    return newSig;
  }, []);

  const deleteSignature = useCallback((id: string) => {
    const updated = getSignatures().filter(s => s.id !== id);
    persistSignatures(updated);
    setSignatures(updated);
  }, []);

  const replaceAll = useCallback((sigs: SavedSignature[]) => {
    persistSignatures(sigs);
    setSignatures(sigs);
  }, []);

  return { signatures, addSignature, deleteSignature, replaceAll };
}

export async function syncLocalToCloud(userId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  const local = getSignatures();
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

  if (error) console.error('Cloud sync error:', error);
}

export async function fetchCloudSignatures(userId: string): Promise<SavedSignature[]> {
  if (!isSupabaseConfigured || !supabase) return [];

  const { data, error } = await supabase
    .from('signatures')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Fetch cloud signatures error:', error);
    return [];
  }

  return ((data ?? []) as { id: string; label: string; data_url: string; created_at: string }[]).map(r => ({
    id: r.id ?? Date.now().toString(36),
    label: r.label ?? '',
    dataUrl: r.data_url,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}
