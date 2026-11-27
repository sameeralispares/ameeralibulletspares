/**
 * Provider-independent image resolution.
 *
 * Every part of the website and the admin panel gets an image URL from here,
 * so no page needs to know where a photo is physically stored.
 *
 *  - supabase: the URL is generated from the storage path, as it always was.
 *  - imagekit: the delivery URL saved when the file was uploaded is used.
 */
import { providerOf } from './image-providers';
import { productImageUrl } from './supabase/env';

/** The columns needed to resolve a photo, whichever provider holds it. */
export type StoredImageRef = {
  storage_path: string;
  storage_provider?: string | null;
  image_url?: string | null;
};

export function resolveImageSrc(image: StoredImageRef | null | undefined): string | null {
  if (!image) return null;
  if (providerOf(image.storage_provider) === 'imagekit') return image.image_url?.trim() || null;
  return productImageUrl(image.storage_path);
}

/** Convenience for list rows that carry the columns under different names. */
export function resolveCatalogImageSrc(row: {
  image_path: string | null;
  image_provider?: string | null;
  image_url?: string | null;
}): string | null {
  if (!row.image_path) return null;
  return resolveImageSrc({
    storage_path: row.image_path,
    storage_provider: row.image_provider,
    image_url: row.image_url,
  });
}
