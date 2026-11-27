import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { EmailOtpType } from '@supabase/supabase-js';
import { requireSupabaseEnv } from '@/lib/supabase/env';
import { safeAdminPath } from '@/lib/auth';

/**
 * Landing point for Supabase email links (password recovery).
 *
 * Supports the recommended token_hash template (verifyOtp — no PKCE
 * code-verifier cookie, so recovery works even when the email is opened on a
 * different device or browser) and, as a fallback, the PKCE ?code= flow.
 *
 * The auth cookies set while verifying must travel on the SAME response that
 * redirects the browser onward, so the Supabase client writes its cookies
 * straight onto the redirect response here, rather than through the global
 * cookie store (whose writes a route handler does not reliably attach to an
 * explicit NextResponse.redirect).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeAdminPath(searchParams.get('next'), '/admin/reset-password');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const { url, anonKey } = requireSupabaseEnv();
  const success = NextResponse.redirect(new URL(next, origin));

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          success.cookies.set(name, value, options);
        }
      },
    },
  });

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return success;
    if (process.env.AUTH_DEBUG) console.error('[auth/confirm] verifyOtp:', error.status, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return success;
    if (process.env.AUTH_DEBUG) console.error('[auth/confirm] exchangeCode:', error.status, error.message);
  } else if (process.env.AUTH_DEBUG) {
    console.error('[auth/confirm] no token_hash/type or code in link');
  }

  return NextResponse.redirect(new URL('/admin/login?error=link_invalid', origin));
}
