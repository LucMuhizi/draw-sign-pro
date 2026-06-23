import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when Supabase env vars are present. Components can use this to hide Supabase-dependent UI. */
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.',
    );
  }
  _client = createClient(supabaseUrl, supabaseAnonKey);
  return _client;
}

/**
 * Guaranteed non-null Supabase client.
 * Throws at first access if Supabase is not configured — callers don't need null checks.
 * Check `isSupabaseConfigured` before calling if you need conditional behavior.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClient() as Record<string | symbol, unknown>)[prop];
  },
});
