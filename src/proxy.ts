import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Runs only for /admin and /auth routes:
 *  1. Refreshes the Supabase session cookie (keeps the owner signed in).
 *  2. Optimistic redirect of signed-out visitors to the login page.
 * This is NOT the security boundary — every admin page and Server Action
 * re-verifies the user and admin role on the server, and RLS enforces it again
 * in the database.
 */
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/forgot-password'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (path.startsWith('/admin') && !PUBLIC_ADMIN_PATHS.some((p) => path.startsWith(p)) && !data.user) {
    const login = request.nextUrl.clone();
    login.pathname = '/admin/login';
    login.search = path === '/admin' ? '' : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ['/admin/:path*', '/auth/:path*'],
};
