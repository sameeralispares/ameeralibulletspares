import { imageKitDeliveryUrl, imageKitSettings, imageKitUrl, normaliseEndpoint } from './imagekit';

/**
 * next/image loader (see next.config.ts). Two cases go through ImageKit:
 *
 *  1. A photo already in the ImageKit media library — its saved delivery URL
 *     gets a resize and automatic format appended.
 *  2. A photo in the Supabase bucket, when the URL endpoint is set up as a web
 *     proxy in front of Supabase.
 *
 * Any other URL is returned unchanged. Components must not send those through
 * the loader: use `ShopImage` (src/components/shop-image.tsx), which renders
 * them unoptimized instead.
 */
function resolveImageUrl(src: string, width: number, quality: number): string {
  const raw = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;

  const delivered = imageKitDeliveryUrl(src, width, quality, normaliseEndpoint(raw));
  if (delivered !== src) return delivered;

  return imageKitUrl(src, width, quality, imageKitSettings(raw, process.env.NEXT_PUBLIC_SUPABASE_URL));
}

/** True when the loader can serve this URL resized through ImageKit. */
export function canResizeImage(src: string): boolean {
  return resolveImageUrl(src, 1, 75) !== src;
}

export default function imageLoader({ src, width, quality }: { src: string; width: number; quality?: number }): string {
  return resolveImageUrl(src, width, quality ?? 75);
}
