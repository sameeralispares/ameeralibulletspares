/**
 * The two image storage providers the admin can choose between.
 *
 * Supabase remains the backend for the database, authentication and RLS.
 * Only the image file is affected by this choice.
 */
export const IMAGE_PROVIDERS = ['supabase', 'imagekit'] as const;

export type ImageProvider = (typeof IMAGE_PROVIDERS)[number];

/** Used for existing images and for a shop that has not chosen anything. */
export const DEFAULT_IMAGE_PROVIDER: ImageProvider = 'supabase';

export function isImageProvider(value: unknown): value is ImageProvider {
  return typeof value === 'string' && (IMAGE_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Validates a provider that came from the browser. Returns null for anything
 * unknown, so the server never trusts the value it was sent.
 */
export function parseImageProvider(value: unknown): ImageProvider | null {
  return isImageProvider(value) ? value : null;
}

/** Falls back to Supabase for rows written before the provider column existed. */
export function providerOf(value: unknown): ImageProvider {
  return isImageProvider(value) ? value : DEFAULT_IMAGE_PROVIDER;
}

export const PROVIDER_LABEL: Record<ImageProvider, string> = {
  supabase: 'Supabase Storage',
  imagekit: 'ImageKit',
};

/** Short explanation shown next to the selected provider in the admin. */
export const PROVIDER_BLURB: Record<ImageProvider, string> = {
  supabase:
    'Photos are stored in the shop’s own Supabase bucket, alongside the rest of the shop data. This is the default and needs no extra account.',
  imagekit:
    'Photos are stored in the ImageKit media library and delivered from its image network. Needs the ImageKit keys to be configured on the server.',
};

/** Upload restrictions per provider, shown in the admin and enforced on the server. */
export const PROVIDER_LIMITS: Record<ImageProvider, { maxBytes: number; note: string }> = {
  supabase: { maxBytes: 5 * 1024 * 1024, note: 'Up to 5 MB per photo after optimisation (bucket limit).' },
  imagekit: { maxBytes: 4 * 1024 * 1024, note: 'Up to 4 MB per photo after optimisation (passes through the website server).' },
};
