import 'server-only';

/**
 * Server-side image file operations that depend on which provider holds the
 * file. Everything that touches a provider's API goes through here, so a
 * delete can never be sent to the wrong provider: the decision is always made
 * from the provider recorded on the image row.
 */
import type { AdminSession } from './auth';
import { providerOf, type ImageProvider, PROVIDER_LABEL } from './image-providers';
import {
  checkImageKitAccount,
  deleteFromImageKit,
  fetchImageKitUsage,
  formatBytes,
  type ProviderResult,
  type ProviderStatus,
} from './imagekit';
import { imageKitConfigGaps, imageKitCredentials } from './imagekit-server';
import { PRODUCT_IMAGE_BUCKET } from './supabase/env';

type Db = AdminSession['supabase'];

/** The image columns needed to delete a file from the right place. */
export type DeletableImage = {
  storage_path: string;
  storage_provider?: string | null;
  provider_file_id?: string | null;
  product_id?: string | null;
};

/** Network calls from the settings page must not hang the page. */
const STATUS_TIMEOUT_MS = 5000;

function timeoutFetch(ms: number): typeof fetch {
  return (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(ms) });
}

/**
 * Deletes one file from the provider recorded on its row. A Supabase image is
 * never looked for in ImageKit, and an ImageKit image is never looked for in
 * the Supabase bucket.
 */
export async function deleteStoredFile(db: Db, image: DeletableImage): Promise<ProviderResult<'deleted' | 'already-gone'>> {
  const provider = providerOf(image.storage_provider);

  if (provider === 'imagekit') {
    const fileId = image.provider_file_id?.trim();
    if (!fileId) {
      return { ok: false, error: 'This photo has no ImageKit file id, so the file could not be deleted from ImageKit.' };
    }
    const cfg = imageKitCredentials();
    if (!cfg) {
      return {
        ok: false,
        error: 'ImageKit is not configured on the server, so the file could not be deleted from ImageKit.',
      };
    }
    return deleteFromImageKit(cfg, fileId, timeoutFetch(STATUS_TIMEOUT_MS));
  }

  const { error } = await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([image.storage_path]);
  if (error) return { ok: false, error: 'The photo file could not be deleted from Supabase Storage.' };
  return { ok: true, value: 'deleted' };
}

/**
 * Records a file that could not be deleted from its provider, with everything
 * needed to retry, so it can be found again instead of becoming a silent
 * orphan.
 */
export async function queueFileForCleanup(db: Db, image: DeletableImage, reason: string): Promise<void> {
  const { error } = await db.from('image_cleanup_queue').insert({
    storage_provider: providerOf(image.storage_provider),
    storage_path: image.storage_path,
    provider_file_id: image.provider_file_id ?? null,
    product_id: image.product_id ?? null,
    last_error: reason.slice(0, 500),
  });
  if (error) console.error('[admin] could not queue image cleanup:', error.message);
}

export type CleanupOutcome = { cleaned: number; failed: number; remaining: number };

/** Retries every queued file, removing the entries that succeed. */
export async function processCleanupQueue(db: Db, limit = 25): Promise<CleanupOutcome> {
  const { data: rows, error } = await db
    .from('image_cleanup_queue')
    .select('id, storage_provider, storage_path, provider_file_id, attempts')
    .order('created_at')
    .limit(limit);
  if (error || !rows) return { cleaned: 0, failed: 0, remaining: 0 };

  let cleaned = 0;
  let failed = 0;
  for (const row of rows) {
    const result = await deleteStoredFile(db, row);
    if (result.ok) {
      await db.from('image_cleanup_queue').delete().eq('id', row.id);
      cleaned += 1;
    } else {
      failed += 1;
      await db
        .from('image_cleanup_queue')
        .update({ attempts: Math.min(1000, row.attempts + 1), last_error: result.error.slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', row.id);
    }
  }
  const { count } = await db.from('image_cleanup_queue').select('id', { count: 'exact', head: true });
  return { cleaned, failed, remaining: count ?? 0 };
}

export async function pendingCleanupCount(db: Db): Promise<number> {
  const { count, error } = await db.from('image_cleanup_queue').select('id', { count: 'exact', head: true });
  if (error) return 0;
  return count ?? 0;
}

export type StorageOverview = {
  statuses: ProviderStatus[];
  /** Null when the provider's API does not expose usage to this account. */
  imagekitUsage: string | null;
  supabaseUsage: string | null;
  /** Names of the missing environment variables, never any key material. */
  imagekitConfigGaps: string[];
  pendingCleanups: number;
};

/**
 * Live connection status for both providers, checked on the server. Nothing
 * here is a hardcoded success label, and usage is reported only when a
 * provider actually returns it.
 */
export async function storageOverview(db: Db): Promise<StorageOverview> {
  const cfg = imageKitCredentials();
  const fetchWithTimeout = timeoutFetch(STATUS_TIMEOUT_MS);

  const [supabase, imagekit, imagekitUsage, supabaseUsage, pendingCleanups] = await Promise.all([
    checkSupabaseBucket(db),
    checkImageKitAccount(cfg, fetchWithTimeout),
    fetchImageKitUsage(cfg, fetchWithTimeout),
    supabaseBucketUsage(db),
    pendingCleanupCount(db),
  ]);

  return {
    statuses: [supabase, imagekit],
    imagekitUsage,
    supabaseUsage,
    imagekitConfigGaps: imageKitConfigGaps(),
    pendingCleanups,
  };
}

/** Reads one object from the bucket to prove the connection really works. */
async function checkSupabaseBucket(db: Db): Promise<ProviderStatus> {
  const { error } = await db.storage.from(PRODUCT_IMAGE_BUCKET).list('', { limit: 1 });
  if (error) {
    return { provider: 'supabase', state: 'error', detail: `The ${PRODUCT_IMAGE_BUCKET} bucket could not be read: ${error.message}` };
  }
  return { provider: 'supabase', state: 'ready', detail: `Bucket “${PRODUCT_IMAGE_BUCKET}” is reachable.` };
}

/**
 * Supabase does not expose bucket size through the client API, but the sizes
 * recorded with the images give an honest total for photos uploaded since
 * that column existed. Returns null when nothing is recorded.
 */
async function supabaseBucketUsage(db: Db): Promise<string | null> {
  const { data, error } = await db.from('product_images').select('file_size').eq('storage_provider', 'supabase').not('file_size', 'is', null);
  if (error || !data || data.length === 0) return null;
  const total = data.reduce((sum, row) => sum + (row.file_size ?? 0), 0);
  if (total <= 0) return null;
  return `${formatBytes(total)} in ${data.length} recorded photo${data.length === 1 ? '' : 's'}`;
}

export function providerLabel(provider: ImageProvider): string {
  return PROVIDER_LABEL[provider];
}
