import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

/**
 * Cookie-less anonymous client for PUBLIC reads. Safe to use inside
 * `'use cache'` functions because it never touches request data; everything
 * it can see is limited by RLS to published/active content.
 */
export function createPublicClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
