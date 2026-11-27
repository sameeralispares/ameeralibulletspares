import crypto from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { TAG_CATALOG, TAG_SETTINGS } from '@/lib/data/catalog';

/**
 * Optional: refresh the public website after data was changed OUTSIDE the
 * admin panel (e.g. in the Supabase SQL editor or by a script).
 *   curl -X POST https://<site>/api/revalidate -H "x-revalidate-secret: $REVALIDATE_SECRET"
 * Disabled (404) unless REVALIDATE_SECRET is set. Admin-panel edits never need it.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || secret.length < 24) return new NextResponse(null, { status: 404 });
  const given = request.headers.get('x-revalidate-secret') ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  revalidateTag(TAG_CATALOG, { expire: 0 });
  revalidateTag(TAG_SETTINGS, { expire: 0 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
