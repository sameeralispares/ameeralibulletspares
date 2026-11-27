/** Only allow redirects back into the admin area (prevents open redirects). */
export function safeAdminPath(next: string | null | undefined, fallback = '/admin'): string {
  if (!next || typeof next !== 'string') return fallback;
  if (!next.startsWith('/admin') || next.startsWith('//') || next.includes('\\')) return fallback;
  return next;
}
