import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createServerSupabase } from './supabase/server';

export type AdminSession = {
  userId: string;
  email: string | null;
  supabase: Awaited<ReturnType<typeof createServerSupabase>>;
};

/**
 * Data Access Layer for the admin. Verifies the session with Supabase Auth
 * (getUser contacts the auth server — never trusts the cookie alone) and the
 * admin role in the database. Deduplicated per request.
 */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin');
  if (roleError || isAdmin !== true) return null;
  return { userId: data.user.id, email: data.user.email ?? null, supabase };
});

/** For admin pages: redirect to login when not an authorised admin. */
export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    const supabase = await createServerSupabase();
    const { data } = await supabase.auth.getUser();
    redirect(data.user ? '/admin/login?error=not_authorised' : '/admin/login');
  }
  return session;
}

export { safeAdminPath } from './auth-paths';
