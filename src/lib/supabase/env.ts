/**
 * Public Supabase configuration. Both values are safe to expose to browsers
 * (the anon key only grants what RLS allows). The service-role key is never
 * read by the web application.
 */
export type SupabaseEnv = { url: string; anonKey: string };

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/+$/, ''), anonKey };
}

export function requireSupabaseEnv(): SupabaseEnv {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).',
    );
  }
  return env;
}

export const PRODUCT_IMAGE_BUCKET = 'product-images';

/** Public URL of an object in the product image bucket. */
/** Public URL of the hero image (bucket "brand-images"). Null when Supabase is not configured. */
export function brandImageUrl(storagePath: string): string | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${env.url}/storage/v1/object/public/brand-images/${encoded}`;
}

export function productImageUrl(storagePath: string): string | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${env.url}/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/${encoded}`;
}
