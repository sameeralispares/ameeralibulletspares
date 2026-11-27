/**
 * ImageKit integration: URL delivery and server-side file operations.
 *
 * Nothing here reads environment variables or calls the network on its own.
 * The configuration is always passed in, and every HTTP call takes the fetch
 * implementation as an argument, so all of this is unit tested without an
 * ImageKit account. src/lib/imagekit-server.ts supplies the real values.
 *
 * The private key is used only for the Basic authorization header on calls
 * made from the server. It must never be passed to a client component.
 */
import { z } from 'zod';

export type ImageKitSettings = {
  /** Public URL endpoint, without a trailing slash, e.g. https://ik.imagekit.io/shop1 */
  endpoint: string;
  /** Supabase project origin, e.g. https://abcd.supabase.co */
  supabaseOrigin: string;
};

const PUBLIC_PREFIX = '/storage/v1/object/public/';

export const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';
export const IMAGEKIT_API_BASE = 'https://api.imagekit.io/v1';

/* ------------------------------------------------------------------------ */
/* Delivery URLs                                                             */
/* ------------------------------------------------------------------------ */

/** Returns delivery settings only when both values are present and well-formed. */
export function imageKitSettings(
  endpointRaw: string | undefined,
  supabaseUrlRaw: string | undefined,
): ImageKitSettings | null {
  const endpoint = normaliseEndpoint(endpointRaw);
  const supabase = supabaseUrlRaw?.trim().replace(/\/+$/, '');
  if (!endpoint || !supabase) return null;
  try {
    return { endpoint, supabaseOrigin: new URL(supabase).origin };
  } catch {
    return null;
  }
}

/** Normalises a URL endpoint to `https://host/path` with no trailing slash. */
export function normaliseEndpoint(raw: string | undefined): string | null {
  const value = raw?.trim().replace(/\/+$/, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.search || url.hash) return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

/** ImageKit transformation query for a given rendered width. */
export function imageKitTransform(width: number, quality: number): string {
  const w = Math.max(1, Math.round(width));
  const q = Math.min(100, Math.max(1, Math.round(quality || 75)));
  return `tr=w-${w},q-${q},f-auto`;
}

/**
 * Rewrites a Supabase public-bucket URL to its ImageKit equivalent, so photos
 * stored in Supabase are still delivered through ImageKit's CDN when a URL
 * endpoint is configured as a web proxy. Any other URL is returned unchanged.
 */
export function imageKitUrl(src: string, width: number, quality: number, cfg: ImageKitSettings | null): string {
  if (!cfg || !src) return src;
  const prefix = `${cfg.supabaseOrigin}${PUBLIC_PREFIX}`;
  if (!src.startsWith(prefix)) return src;
  return `${cfg.endpoint}${src.slice(cfg.supabaseOrigin.length)}?${imageKitTransform(width, quality)}`;
}

/**
 * Adds a transformation to a URL that is already an ImageKit delivery URL
 * (an image uploaded to the Media Library). A URL that already carries a
 * transformation, or belongs to another host, is returned unchanged.
 */
export function imageKitDeliveryUrl(src: string, width: number, quality: number, endpoint: string | null): string {
  if (!endpoint || !src.startsWith(`${endpoint}/`)) return src;
  if (src.includes('?')) return src;
  return `${src}?${imageKitTransform(width, quality)}`;
}

/* ------------------------------------------------------------------------ */
/* Server-side credentials and requests                                      */
/* ------------------------------------------------------------------------ */

export type ImageKitCredentials = {
  endpoint: string;
  /** Secret. Server-side only. */
  privateKey: string;
};

/** HTTP Basic header for the ImageKit API: the private key as the username. */
export function imageKitAuthHeader(privateKey: string): string {
  return `Basic ${Buffer.from(`${privateKey}:`).toString('base64')}`;
}

/** Folder a product's files live in, matching the Supabase bucket layout. */
export function imageKitFolder(productId: string): string {
  return `products/${productId}`;
}

const uploadResponseSchema = z.object({
  fileId: z.string().min(1).max(120),
  filePath: z.string().min(1).max(300),
  url: z.string().url().max(600),
  name: z.string().max(300).optional(),
  size: z.number().int().nonnegative().optional(),
  fileType: z.string().max(40).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export type ImageKitFile = z.infer<typeof uploadResponseSchema>;

export type UploadInput = {
  bytes: Uint8Array;
  /** File name including extension, e.g. "9f2c….webp". */
  fileName: string;
  folder: string;
  mimeType: string;
};

export type ProviderResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Uploads one file to the ImageKit Media Library from the server.
 *
 * `useUniqueFileName` is off so the stored path stays predictable
 * (`/products/<product id>/<uuid>.<ext>`); the name already contains a UUID.
 */
export async function uploadToImageKit(
  cfg: ImageKitCredentials,
  input: UploadInput,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult<ImageKitFile>> {
  const form = new FormData();
  form.set('file', new Blob([input.bytes as unknown as BlobPart], { type: input.mimeType }), input.fileName);
  form.set('fileName', input.fileName);
  form.set('folder', input.folder);
  form.set('useUniqueFileName', 'false');

  let response: Response;
  try {
    response = await fetchImpl(IMAGEKIT_UPLOAD_URL, {
      method: 'POST',
      headers: { authorization: imageKitAuthHeader(cfg.privateKey) },
      body: form,
    });
  } catch {
    return { ok: false, error: 'ImageKit could not be reached. Check the internet connection and try again.' };
  }

  if (!response.ok) return { ok: false, error: await imageKitErrorMessage(response, 'upload') };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, error: 'ImageKit returned a response that could not be read.' };
  }

  const parsed = uploadResponseSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: 'ImageKit did not return a usable file id and URL.' };
  return { ok: true, value: parsed.data };
}

/** Deletes one file from the ImageKit Media Library by its file id. */
export async function deleteFromImageKit(
  cfg: ImageKitCredentials,
  fileId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderResult<'deleted' | 'already-gone'>> {
  let response: Response;
  try {
    response = await fetchImpl(`${IMAGEKIT_API_BASE}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { authorization: imageKitAuthHeader(cfg.privateKey) },
    });
  } catch {
    return { ok: false, error: 'ImageKit could not be reached, so the file was not deleted.' };
  }
  if (response.status === 404) return { ok: true, value: 'already-gone' };
  if (!response.ok) return { ok: false, error: await imageKitErrorMessage(response, 'delete') };
  return { ok: true, value: 'deleted' };
}

export type ProviderStatus = {
  provider: 'supabase' | 'imagekit';
  state: 'ready' | 'not-configured' | 'error';
  detail: string;
};

/**
 * Checks the credentials against ImageKit by listing one file. The result is
 * a real server-side check, never a hardcoded success label.
 */
export async function checkImageKitAccount(
  cfg: ImageKitCredentials | null,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderStatus> {
  if (!cfg) {
    return {
      provider: 'imagekit',
      state: 'not-configured',
      detail: 'Not configured. Add IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT to use ImageKit.',
    };
  }
  let response: Response;
  try {
    response = await fetchImpl(`${IMAGEKIT_API_BASE}/files?limit=1`, {
      headers: { authorization: imageKitAuthHeader(cfg.privateKey) },
    });
  } catch {
    return { provider: 'imagekit', state: 'error', detail: 'ImageKit could not be reached from the server.' };
  }
  if (response.status === 401 || response.status === 403) {
    return { provider: 'imagekit', state: 'error', detail: 'ImageKit rejected the private key. Check IMAGEKIT_PRIVATE_KEY.' };
  }
  if (!response.ok) {
    return { provider: 'imagekit', state: 'error', detail: `ImageKit returned an error (${response.status}).` };
  }
  return { provider: 'imagekit', state: 'ready', detail: `Connected to ${cfg.endpoint}.` };
}

/**
 * Storage usage, when the account and permissions expose it. Anything other
 * than a clean answer is reported as unavailable rather than guessed at.
 */
export async function fetchImageKitUsage(
  cfg: ImageKitCredentials | null,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!cfg) return null;
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  const range = `startDate=${start.toISOString().slice(0, 10)}&endDate=${end.toISOString().slice(0, 10)}`;
  try {
    const response = await fetchImpl(`${IMAGEKIT_API_BASE}/accounts/usage?${range}`, {
      headers: { authorization: imageKitAuthHeader(cfg.privateKey) },
    });
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const parsed = z
      .object({ mediaLibraryStorageUsage: z.number().nonnegative().optional(), bandwidthBytes: z.number().nonnegative().optional() })
      .safeParse(json);
    if (!parsed.success) return null;
    const parts: string[] = [];
    if (parsed.data.mediaLibraryStorageUsage !== undefined) parts.push(`${formatBytes(parsed.data.mediaLibraryStorageUsage)} stored`);
    if (parsed.data.bandwidthBytes !== undefined) parts.push(`${formatBytes(parsed.data.bandwidthBytes)} delivered in 30 days`);
    return parts.length > 0 ? parts.join(' · ') : null;
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Turns an ImageKit error response into a message an admin can act on. */
async function imageKitErrorMessage(response: Response, what: 'upload' | 'delete'): Promise<string> {
  let detail = '';
  try {
    const body: unknown = await response.json();
    const parsed = z.object({ message: z.string().max(300) }).safeParse(body);
    if (parsed.success) detail = parsed.data.message;
  } catch {
    /* no JSON body */
  }
  if (response.status === 401 || response.status === 403) {
    return `ImageKit rejected the request (${response.status}). Check the ImageKit private key.`;
  }
  const base = what === 'upload' ? 'ImageKit refused the upload' : 'ImageKit refused the delete';
  return detail ? `${base}: ${detail}` : `${base} (${response.status}).`;
}
