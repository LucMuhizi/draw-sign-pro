import { supabase, isSupabaseConfigured } from './supabase';
import { getItem, setItem } from './storage';
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
  /** Phase 3 — presence timestamp. Always present, even if unsigned.
   *  Used as the natural sort order for SEQUENTIAL mode (who's next). */
  createdAt: number;
}

export type SessionMode = 'parallel' | 'sequential';

export interface SigningSession {
  id: string;
  documentName: string;
  documentHash: string;
  /** Phase 3 — parallel = all participants can sign in any order;
   *  sequential = only the next pending participant (sorted by createdAt)
   *  can sign at a time. Default 'parallel'. */
  mode: SessionMode;
  status: 'pending' | 'in_progress' | 'completed' | 'expired';
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  shareToken: string;
  participants: SigningParticipant[];
}

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const SESSION_PREFIX = 'draw-sign-pro-mp-session';

/**
 * Phase 3 — write/read the full session object under a single
 * `draw-sign-pro-mp-session-{shareToken}` key. Mirrors the
 * Supabase REST pattern (sessions have many participants joined
 * inline) so the local-only path looks identical to callers.
 */

async function persistLocal(session: SigningSession): Promise<void> {
  await setItem(`${SESSION_PREFIX}-${session.shareToken}`, session);
  await addToTokenIndex(session.shareToken);
}

async function readLocal(shareToken: string): Promise<SigningSession | null> {
  return (await getItem<SigningSession>(`${SESSION_PREFIX}-${shareToken}`)) ?? null;
}

/**
 * Phase 3 — token index so `addParticipant(sessionId, ...)` can
 * resolve a Supabase UUID (which it receives from the created row)
 * to the shareToken under which the full session is stored. Without
 * this, callers would have to thread shareToken through every API.
 */
async function addToTokenIndex(token: string): Promise<void> {
  const list = (await getItem<string[]>('draw-sign-pro-mp-tokens')) ?? [];
  if (!list.includes(token)) {
    list.push(token);
    await setItem('draw-sign-pro-mp-tokens', list);
  }
}

async function findSessionLocally(idOrToken: string): Promise<SigningSession | null> {
  // Fast path: caller passed the shareToken.
  const direct = await readLocal(idOrToken);
  if (direct) return direct;
  // Slow path: caller passed the Supabase UUID. Walk the index.
  const tokens = (await getItem<string[]>('draw-sign-pro-mp-tokens')) ?? [];
  for (const token of tokens) {
    const s = await readLocal(token);
    if (s?.id === idOrToken) return s;
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Crypto-free fallback (very old browsers).
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function newToken(): string {
  // 22 chars of base36 randomness. Sufficient collision-resistance
  // for a single-user demo; the Supabase row type uses `gen_random_uuid`
  // for production.
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 14);
}

function normSession(data: Record<string, unknown>): SigningSession {
  const participants = ((data.participants as Array<Record<string, unknown>>) ?? []).map(p => ({
    id: p.id as string,
    email: p.email as string,
    name: (p.name as string) || '',
    color: (p.color as string) || '#3b82f6',
    role: (p.role as SigningParticipant['role']) || 'signer',
    status: (p.status as SigningParticipant['status']) || 'pending',
    fields: (p.fields as SignaturePlacement[]) || [],
    createdAt: p.created_at ? new Date(p.created_at as string).getTime() : Date.now(),
  }));

  return {
    id: data.id as string,
    documentName: data.document_name as string,
    documentHash: data.document_hash as string,
    mode: ((data.mode as SessionMode) || 'parallel'),
    status: (data.status as SigningSession['status']) || 'pending',
    createdBy: data.created_by as string,
    createdAt: data.created_at as string,
    completedAt: data.completed_at as string | undefined,
    shareToken: data.share_token as string,
    participants,
  };
}

// ─── Public Session CRUD ────────────────────────────────────────────

export async function createSigningSession(
  documentName: string,
  documentHash: string,
  mode: SessionMode = 'parallel',
): Promise<{ session: SigningSession | null; error: string | null }> {
  const now = new Date().toISOString();
  const shareToken = newToken();

  // Always seed the LOCAL store first so a session created offline is
  // durable and discoverable to the recipient page on the same device.
  const local: SigningSession = {
    id: newId(),
    documentName,
    documentHash,
    mode,
    status: 'pending',
    createdBy: '',
    createdAt: now,
    shareToken,
    participants: [],
  };
  await persistLocal(local);

  if (!isSupabaseConfigured) return { session: local, error: null };

  // Supabase path — best-effort; we never throw off the local write.
  try {
    const { data, error } = await supabase
      .from('signing_sessions')
      .insert({
        document_name: documentName,
        document_hash: documentHash,
        mode,
        status: 'pending',
        share_token: shareToken,
      })
      .select('*')
      .single();

    if (error || !data) {
      return { session: local, error: error?.message || 'Supabase write failed; using local' };
    }
    // Mirror the Supabase row id back into our local copy so the
    // participants joined-supabase lookup later matches.
    const synced: SigningSession = { ...local, id: data.id as string };
    await persistLocal(synced);
    return { session: synced, error: null };
  } catch (err) {
    return {
      session: local,
      error: err instanceof Error ? err.message : 'Supabase unreachable; using local',
    };
  }
}

export async function getSessionByToken(
  shareToken: string,
): Promise<{ session: SigningSession | null; error: string | null }> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('signing_sessions')
        .select('*, participants:signing_participants(*)')
        .eq('share_token', shareToken)
        .single();

      if (!error && data) {
        const session = normSession(data);
        // Mirror into local so subsequent offline reads are exact.
        await persistLocal(session);
        return { session, error: null };
      }
    } catch {
      // fall through to local
    }
  }

  const local = await readLocal(shareToken);
  if (local) return { session: local, error: null };
  return { session: null, error: 'Session not found' };
}

// ─── Participants CRUD ─────────────────────────────────────────────

export async function addParticipant(
  sessionId: string,
  email: string,
  name: string,
  role: 'sender' | 'signer' | 'viewer' = 'signer',
): Promise<{ participant: SigningParticipant | null; error: string | null }> {
  const participant: SigningParticipant = {
    id: newId(),
    email,
    name,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    role,
    status: 'pending',
    fields: [],
    createdAt: Date.now(),
  };

  // Local first.
  const target = await findSessionLocally(sessionId);
  if (target) {
    target.participants = [...target.participants, participant];
    await persistLocal(target);
  }

  if (isSupabaseConfigured && target) {
    try {
      const { data, error } = await supabase
        .from('signing_participants')
        .insert({
          session_id: target.id,
          email,
          name,
          role,
          color: participant.color,
          fields: [],
        })
        .select('*')
        .single();
      if (!error && data?.id) {
        // Phase 3 — CRITICAL cloud-id sync. Supabase assigns its own
        // UUID via gen_random_uuid() so caller-derived ids diverge
        // from cloud ids. Without this rewrite, a later
        // `updateParticipantStatus(localUuid, 'signed')` would route
        // through .eq('id', localUuid) which matches ZERO rows in
        // the cloud. We update the local participant.id AND target row
        // so subsequent reads return the cloud id, keeping local and
        // cloud in lockstep.
        participant.id = data.id as string;
        const idx = target.participants.findIndex(p => p.email === email && p.role === role && p.status === 'pending');
        if (idx >= 0) target.participants[idx] = participant;
        await persistLocal(target);
      }
    } catch {
      // Swallow — local-first is durable; cloud will sync later.
    }
  }

  return { participant, error: null };
}

export async function updateParticipantStatus(
  participantId: string,
  status: SigningParticipant['status'],
): Promise<{ error: string | null }> {
  const signedAt = status === 'signed' ? new Date().toISOString() : undefined;

  // Update every local session that contains this participant.
  // In practice recipients only have one session open so this is
  // cheap, but the cascade is correct for the sender flow too.
  const result = await mutateAllLocalSessions((session) => {
    session.participants = session.participants.map((p) =>
      p.id === participantId ? { ...p, status, fields: p.fields } : p,
    );
  });

  if (isSupabaseConfigured) {
    try {
      const updates: Record<string, unknown> = { status };
      if (signedAt) updates.signed_at = signedAt;
      await supabase
        .from('signing_participants')
        .update(updates)
        .eq('id', participantId);
    } catch {
      // ignore — local is the source of truth offline
    }
  }

  return { error: result ? null : 'No local session updated' };
}

export async function saveParticipantFields(
  participantId: string,
  fields: SignaturePlacement[],
): Promise<{ error: string | null }> {
  await mutateAllLocalSessions((session) => {
    session.participants = session.participants.map((p) =>
      p.id === participantId ? { ...p, fields } : p,
    );
  });
  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('signing_participants')
        .update({ fields })
        .eq('id', participantId);
    } catch {
      // ignore
    }
  }
  return { error: null };
}

/**
 * Apply a mutation to EVERY local session whose participant list
 * references the target id. Returns true if any session matched.
 */
async function mutateAllLocalSessions(
  mutator: (s: SigningSession) => void,
): Promise<boolean> {
  // Performance note: the local store currently exposes only
  // getKeysByPrefix through the storage layer, but the goal here is
  // a single page load so we instead brute-force every known session
  // token via a single index key written at session-create time.
  const tokenIndex = (await getItem<string[]>('draw-sign-pro-mp-tokens')) ?? [];
  let mutated = false;
  for (const token of tokenIndex) {
    const sess = await readLocal(token);
    if (!sess) continue;
    const before = JSON.stringify(sess.participants);
    mutator(sess);
    const after = JSON.stringify(sess.participants);
    if (before !== after) {
      await persistLocal(sess);
      mutated = true;
    }
  }
  return mutated;
}

// ─── Session Status ────────────────────────────────────────────────

export async function checkAllSigned(sessionId: string): Promise<boolean> {
  const session = await findSessionLocally(sessionId);
  if (!session) return false;
  if (session.participants.length === 0) return false;
  return session.participants.every(p => p.status === 'signed' || p.status === 'declined');
}

export async function updateSessionStatus(
  sessionId: string,
  status: SigningSession['status'],
): Promise<void> {
  const session = await findSessionLocally(sessionId);
  if (!session) return;
  session.status = status;
  if (status === 'completed') session.completedAt = new Date().toISOString();
  await persistLocal(session);

  if (isSupabaseConfigured) {
    try {
      const updates: Record<string, unknown> = { status };
      if (status === 'completed') updates.completed_at = session.completedAt;
      await supabase.from('signing_sessions').update(updates).eq('id', sessionId);
    } catch {
      // ignore
    }
  }
}

// ─── Helpers (export) ──────────────────────────────────────────────

export function getShareUrl(shareToken: string): string {
  return `${window.location.origin}/sign/${shareToken}`;
}

/**
 * Phase 3 — sequential mode state machine: pick the next participant
 * who is allowed to sign in sequential mode (the first non-signed one
 * in createdAt order). For parallel mode every participant is
 * independent so the caller can pick intentionally via
 * `currentRecipientId`. Returns null when everyone has signed or in
 * parallel mode where there is no order.
 */
export function pickSequentialRecipient(
  participants: SigningParticipant[],
): SigningParticipant | null {
  const sorted = [...participants].sort((a, b) => a.createdAt - b.createdAt);
  return sorted.find(p => p.status !== 'signed' && p.status !== 'declined') ?? null;
}
