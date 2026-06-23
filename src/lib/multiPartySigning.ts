import { supabase, isSupabaseConfigured } from './supabase';
import type { SignaturePlacement } from './pdfSigner';

// ─── Types ──────────────────────────────────────────────────────────

export interface SigningParticipant {
  id: string;
  email: string;
  name: string;
  color: string;
  role: 'sender' | 'signer' | 'viewer';
  status: 'pending' | 'viewed' | 'signed' | 'declined';
  fields: SignaturePlacement[];
}

export interface SigningSession {
  id: string;
  documentName: string;
  documentHash: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  shareToken: string;
  participants: SigningParticipant[];
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

// ─── Session CRUD ──────────────────────────────────────────────────

export async function createSigningSession(
  documentName: string,
  documentHash: string,
): Promise<{ session: SigningSession | null; error: string | null }> {
  if (!isSupabaseConfigured) return { session: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('signing_sessions')
    .insert({
      document_name: documentName,
      document_hash: documentHash,
      status: 'pending',
    })
    .select('*')
    .single();

  if (error || !data) return { session: null, error: error?.message || 'Failed to create session' };

  return {
    session: {
      id: data.id,
      documentName: data.document_name,
      documentHash: data.document_hash,
      status: data.status,
      createdBy: data.created_by,
      createdAt: data.created_at,
      completedAt: data.completed_at,
      shareToken: data.share_token,
      participants: [],
    },
    error: null,
  };
}

export async function getSessionByToken(
  shareToken: string,
): Promise<{ session: SigningSession | null; error: string | null }> {
  if (!isSupabaseConfigured) return { session: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('signing_sessions')
    .select('*, participants:signing_participants(*)')
    .eq('share_token', shareToken)
    .single();

  if (error || !data) return { session: null, error: 'Session not found' };

  return {
    session: mapSession(data),
    error: null,
  };
}

// ─── Participants CRUD ─────────────────────────────────────────────

export async function addParticipant(
  sessionId: string,
  email: string,
  name: string,
  role: 'sender' | 'signer' | 'viewer' = 'signer',
): Promise<{ participant: SigningParticipant | null; error: string | null }> {
  if (!isSupabaseConfigured) return { participant: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('signing_participants')
    .insert({
      session_id: sessionId,
      email,
      name,
      role,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      fields: [],
    })
    .select('*')
    .single();

  if (error || !data) return { participant: null, error: error?.message || 'Failed to add participant' };

  return {
    participant: {
      id: data.id,
      email: data.email,
      name: data.name,
      color: data.color,
      role: data.role,
      status: 'pending',
      fields: [],
    },
    error: null,
  };
}

export async function updateParticipantStatus(
  participantId: string,
  status: SigningParticipant['status'],
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const updates: Record<string, unknown> = { status };
  if (status === 'signed') updates.signed_at = new Date().toISOString();

  const { error } = await supabase
    .from('signing_participants')
    .update(updates)
    .eq('id', participantId);

  return { error: error?.message || null };
}

export async function saveParticipantFields(
  participantId: string,
  fields: SignaturePlacement[],
): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('signing_participants')
    .update({ fields })
    .eq('id', participantId);

  return { error: error?.message || null };
}

// ─── Session Status ────────────────────────────────────────────────

export async function checkAllSigned(sessionId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  const { data } = await supabase
    .from('signing_participants')
    .select('status')
    .eq('session_id', sessionId);

  const participants = (data ?? []) as { status: string }[];
  if (participants.length === 0) return false;
  return participants.every(p => p.status === 'signed' || p.status === 'declined');
}

export async function updateSessionStatus(
  sessionId: string,
  status: SigningSession['status'],
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const updates: Record<string, unknown> = { status };
  if (status === 'completed') updates.completed_at = new Date().toISOString();

  await supabase
    .from('signing_sessions')
    .update(updates)
    .eq('id', sessionId);
}

// ─── Helpers ───────────────────────────────────────────────────────

function mapSession(data: Record<string, unknown>): SigningSession {
  const participants = ((data.participants as Array<Record<string, unknown>>) ?? []).map(p => ({
    id: p.id as string,
    email: p.email as string,
    name: (p.name as string) || '',
    color: (p.color as string) || '#3b82f6',
    role: (p.role as SigningParticipant['role']) || 'signer',
    status: (p.status as SigningParticipant['status']) || 'pending',
    fields: (p.fields as SignaturePlacement[]) || [],
  }));

  return {
    id: data.id as string,
    documentName: data.document_name as string,
    documentHash: data.document_hash as string,
    status: (data.status as SigningSession['status']) || 'pending',
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
    completedAt: data.completed_at as string | undefined,
    shareToken: data.share_token as string,
    participants,
  };
}

export function getShareUrl(shareToken: string): string {
  return `${window.location.origin}/sign/${shareToken}`;
}
