import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { connection } from 'next/server';
import { requireSupabaseEnv } from './env';

/**
 * Per-request Supabase client bound to the signed-in user's session cookies.
 * Used by the admin panel and Server Actions. Reads request data, so callers
 * must sit behind <Suspense> (Cache Components) or inside a Server Action.
 */
export async function createServerSupabase() {
  // Always request-time: auth checks read the clock and must never be prerendered.
  // This must run before the env check, so a prerender never reaches requireSupabaseEnv().
  await connection();
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies are read-only there. The
          // proxy refreshes sessions, so this is safe to ignore.
        }
      },
    },
  });
}
