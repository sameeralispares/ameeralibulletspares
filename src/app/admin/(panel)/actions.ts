'use server';

import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { getAdminSession, type AdminSession } from '@/lib/auth';
import { TAG_CATALOG, TAG_SETTINGS } from '@/lib/data/catalog';
import {
  PROVIDER_LABEL,
  PROVIDER_LIMITS,
  parseImageProvider,
  providerOf,
  type ImageProvider,
} from '@/lib/image-providers';
import {
  deleteStoredFile,
  processCleanupQueue,
  queueFileForCleanup,
} from '@/lib/image-storage';
import { imageKitFolder, uploadToImageKit } from '@/lib/imagekit';
import { imageKitCredentials } from '@/lib/imagekit-server';
import { PRODUCT_IMAGE_BUCKET } from '@/lib/supabase/env';
import {
  fieldErrors,
  isValidImagePath,
  isValidProviderPath,
  productFromForm,
  settingsFromForm,
  taxonomyFromForm,
} from '@/lib/validation';
import { planImport, uniqueSlug } from '@/lib/product-import';

/**
 * Every action re-verifies the admin on the server (never trusts the client)
 * and the database enforces the same rule again through RLS.
 */

export type ActionState = {
  ok?: boolean;
  /** Something finished, but with a caveat worth showing in amber. */
  warning?: string;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
} | null;

type AdminDb = AdminSession['supabase'];

const NOT_AUTHORISED: ActionState = { error: 'Your session has expired or you are not an admin. Please sign in again.' };

async function admin() {
  return getAdminSession();
}

function dbError(error: { code?: string; message: string }, what: string): ActionState {
  if (error.code === '23505') {
    return { error: `That URL name is already used by another ${what}. Choose a different one.`, fieldErrors: { slug: 'Already in use' } };
  }
  if (error.code === '42501') return NOT_AUTHORISED;
  if (error.code === '23514') return { error: 'One of the values is not allowed. Please check the form.' };
  console.error(`[admin] ${what}:`, error.message);
  return { error: `Could not save the ${what}. Please try again.` };
}

const uuid = z.string().uuid();

/** Also drop the rendered page for a product URL (status/slug changes, deletes). */
function refreshProductPage(slug: string | null | undefined) {
  if (slug) revalidatePath(`/products/${slug}`);
}

// ---------------------------------------------------------------- products

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const parsed = productFromForm(formData);
  if (!parsed.success) {
    return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  }
  const { id, model_ids, ...row } = parsed.data;
  const db = session.supabase;

  let productId = id;
  if (id) {
    const { data: before } = await db.from('products').select('slug').eq('id', id).maybeSingle();
    const { error } = await db.from('products').update(row).eq('id', id);
    if (error) return dbError(error, 'product');
    refreshProductPage(before?.slug);
    refreshProductPage(row.slug);
  } else {
    const { data, error } = await db.from('products').insert(row).select('id').single();
    if (error) return dbError(error, 'product');
    productId = data.id;
  }

  const { error: modelError } = await db.rpc('set_product_models', { p_product_id: productId, p_model_ids: model_ids });
  if (modelError) return dbError(modelError, 'compatible models');

  revalidateTag(TAG_CATALOG, { expire: 0 });
  if (!id) redirect(`/admin/products/${productId}?created=1`);
  return { ok: true, message: row.status === 'published' ? 'Saved. Changes are live on the website.' : 'Saved.' };
}

const quickSchema = z.object({
  id: uuid,
  field: z.enum(['availability', 'status', 'is_featured']),
  value: z.string(),
});

/** One-tap updates from the product list (availability, status, featured). */
export async function quickUpdateProduct(formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const parsed = quickSchema.safeParse({ id: formData.get('id'), field: formData.get('field'), value: formData.get('value') });
  if (!parsed.success) return { error: 'Invalid update.' };
  const { id, field, value } = parsed.data;

  let patch: Record<string, unknown>;
  if (field === 'availability') {
    if (!['available', 'out_of_stock', 'contact_to_confirm'].includes(value)) return { error: 'Invalid availability.' };
    patch = { availability: value };
  } else if (field === 'status') {
    if (!['draft', 'published', 'hidden', 'archived'].includes(value)) return { error: 'Invalid status.' };
    patch = { status: value };
  } else {
    patch = { is_featured: value === 'true' };
  }

  const { data, error } = await session.supabase.from('products').update(patch).eq('id', id).select('id, slug');
  if (error) return dbError(error, 'product');
  if (!data?.length) return { error: 'Product not found.' };
  revalidateTag(TAG_CATALOG, { expire: 0 });
  refreshProductPage(data[0].slug);
  return { ok: true, message: 'Updated.' };
}

export async function deleteProduct(formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const id = uuid.safeParse(formData.get('id'));
  if (!id.success) return { error: 'Invalid product.' };
  const db = session.supabase;

  const { data: images, error: imgErr } = await db
    .from('product_images')
    .select('storage_path, storage_provider, provider_file_id, product_id')
    .eq('product_id', id.data);
  if (imgErr) return dbError(imgErr, 'product');

  // Each file goes back to the provider that holds it. A provider that is
  // down or misconfigured must not make the product undeletable, so failures
  // are queued for cleanup and counted for the admin.
  let orphans = 0;
  for (const image of images ?? []) {
    const removal = await deleteStoredFile(db, image);
    if (!removal.ok) {
      orphans += 1;
      await queueFileForCleanup(db, image, removal.error);
    }
  }

  const { data: gone, error } = await db.from('products').delete().eq('id', id.data).select('slug');
  if (error) return dbError(error, 'product');
  revalidateTag(TAG_CATALOG, { expire: 0 });
  refreshProductPage(gone?.[0]?.slug);
  redirect(orphans > 0 ? `/admin/products?deleted=1&orphans=${orphans}` : '/admin/products?deleted=1');
}

// ------------------------------------------------------------------ images

const UPLOAD_MIME_TYPES = ['image/webp', 'image/jpeg', 'image/png'] as const;

const addImageSchema = z.object({
  productId: uuid,
  path: z.string().max(200),
  width: z.number().int().positive().max(10000).nullable(),
  height: z.number().int().positive().max(10000).nullable(),
  fileSize: z.number().int().positive().max(20 * 1024 * 1024).nullable().optional(),
  mimeType: z.enum(UPLOAD_MIME_TYPES).nullable().optional(),
});

/**
 * Where a new row goes in the gallery, and whether it becomes the main photo.
 * Shared by both upload paths.
 */
type ImageSlot =
  | { ok: true; sortOrder: number; isPrimary: boolean }
  | { ok: false; error: { code?: string; message: string } };

async function nextImageSlot(db: AdminDb, productId: string): Promise<ImageSlot> {
  const { data, error } = await db.from('product_images').select('sort_order, is_primary').eq('product_id', productId);
  if (error) return { ok: false, error };
  return {
    ok: true,
    sortOrder: Math.max(0, ...(data ?? []).map((e) => e.sort_order)) + 10,
    isPrimary: !(data ?? []).some((e) => e.is_primary),
  };
}

/** Record an image that the browser already uploaded to Storage. */
export async function addProductImage(input: z.input<typeof addImageSchema>): Promise<(NonNullable<ActionState> & { imageId?: string }) | null> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const parsed = addImageSchema.safeParse(input);
  if (!parsed.success || !isValidImagePath(parsed.data.productId, parsed.data.path)) {
    return { error: 'Invalid image upload.' };
  }
  const { productId, path, width, height } = parsed.data;
  const db = session.supabase;

  const slot = await nextImageSlot(db, productId);
  if (!slot.ok) return dbError(slot.error, 'image');

  const { data, error } = await db
    .from('product_images')
    .insert({
      product_id: productId,
      storage_path: path,
      width,
      height,
      sort_order: slot.sortOrder,
      is_primary: slot.isPrimary,
      storage_provider: 'supabase',
      file_size: parsed.data.fileSize ?? null,
      mime_type: parsed.data.mimeType ?? null,
    })
    .select('id')
    .single();
  if (error) {
    // Don't leave an orphaned file behind.
    await db.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
    return dbError(error, 'image');
  }
  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true, imageId: data.id };
}

/**
 * Uploads one photo to ImageKit from the server and records it.
 *
 * The ImageKit private key is read server-side only (never sent to the
 * browser), the provider the browser asked for is validated against the known
 * list, and the file type and size are checked again here. If the upload
 * succeeds but the database insert fails, the uploaded file is deleted again so
 * no orphan is left behind. There is no silent fallback to the other provider:
 * a failure is reported with the provider named.
 */
export async function uploadProductImageToProvider(
  formData: FormData,
): Promise<(NonNullable<ActionState> & { imageId?: string }) | null> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;

  const productId = uuid.safeParse(formData.get('productId'));
  if (!productId.success) return { error: 'Invalid product.' };

  const provider = parseImageProvider(formData.get('provider'));
  if (!provider) return { error: 'Choose a valid image storage provider.' };
  if (provider !== 'imagekit') {
    return { error: 'Supabase Storage uploads go straight to the bucket from the browser.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a photo to upload.' };
  if (!(UPLOAD_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: 'Only JPG, PNG or WebP photos can be stored on ImageKit.' };
  }
  const limit = PROVIDER_LIMITS.imagekit.maxBytes;
  if (file.size > limit) {
    return { error: `This photo is still larger than ${Math.round(limit / (1024 * 1024))} MB after optimisation. Please use a smaller photo.` };
  }

  const cfg = imageKitCredentials();
  if (!cfg) {
    return {
      error:
        'ImageKit is not configured on the server, so nothing was uploaded. Add the ImageKit keys in the environment, or choose Supabase Storage for this photo.',
    };
  }

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/jpeg' ? 'jpg' : 'webp';
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const uploaded = await uploadToImageKit(cfg, {
    bytes,
    fileName,
    folder: imageKitFolder(productId.data),
    mimeType: file.type,
  });
  if (!uploaded.ok) return { error: uploaded.error };

  const stored = uploaded.value;
  const db = session.supabase;

  /** Give up on this file and take it back out of ImageKit. */
  async function unwind(message: string): Promise<ActionState> {
    const removed = await deleteStoredFile(db, {
      storage_path: stored.filePath,
      storage_provider: 'imagekit',
      provider_file_id: stored.fileId,
      product_id: productId.data,
    });
    if (!removed.ok) {
      await queueFileForCleanup(
        db,
        { storage_path: stored.filePath, storage_provider: 'imagekit', provider_file_id: stored.fileId, product_id: productId.data },
        removed.error,
      );
    }
    return { error: message };
  }

  if (!isValidProviderPath('imagekit', productId.data, stored.filePath)) {
    return unwind('ImageKit stored the photo under an unexpected path, so it was not saved.');
  }

  const slot = await nextImageSlot(db, productId.data);
  if (!slot.ok) return unwind('The photo could not be recorded. Please try again.');

  const { data, error } = await db
    .from('product_images')
    .insert({
      product_id: productId.data,
      storage_path: stored.filePath,
      storage_provider: 'imagekit',
      image_url: stored.url,
      provider_file_id: stored.fileId,
      width: stored.width ?? null,
      height: stored.height ?? null,
      file_size: stored.size ?? file.size,
      mime_type: file.type,
      sort_order: slot.sortOrder,
      is_primary: slot.isPrimary,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[admin] imagekit image insert failed:', error.message);
    return unwind('The photo reached ImageKit but could not be recorded, so it was removed again. Please try again.');
  }

  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true, imageId: data.id, message: `Photo uploaded to ${PROVIDER_LABEL.imagekit}.` };
}

export async function removeProductImage(imageId: string): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  if (!uuid.safeParse(imageId).success) return { error: 'Invalid image.' };
  const db = session.supabase;

  const { data: img, error } = await db
    .from('product_images')
    .select('id, product_id, storage_path, is_primary, storage_provider, provider_file_id')
    .eq('id', imageId)
    .maybeSingle();
  if (error) return dbError(error, 'image');
  if (!img) return { error: 'Image not found.' };

  // The file is deleted from the provider recorded on this row, never from
  // the other one.
  const removal = await deleteStoredFile(db, img);

  const { error: delErr } = await db.from('product_images').delete().eq('id', imageId);
  if (delErr) return dbError(delErr, 'image');

  // The photo is off the website either way; a file left at the provider is
  // recorded so it can be retried instead of becoming a silent orphan.
  if (!removal.ok) await queueFileForCleanup(db, img, removal.error);

  if (img.is_primary) {
    const { data: next } = await db
      .from('product_images')
      .select('id')
      .eq('product_id', img.product_id)
      .order('sort_order')
      .limit(1)
      .maybeSingle();
    if (next) await db.rpc('set_primary_image', { p_image_id: next.id });
  }
  revalidateTag(TAG_CATALOG, { expire: 0 });
  if (!removal.ok) {
    return {
      ok: true,
      warning: `Photo removed from the website, but the file is still on ${PROVIDER_LABEL[providerOf(img.storage_provider)]}: ${removal.error} It is queued for cleanup — retry it under Settings → Image storage.`,
    };
  }
  return { ok: true, message: 'Photo removed.' };
}

export async function setPrimaryImage(imageId: string): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  if (!uuid.safeParse(imageId).success) return { error: 'Invalid image.' };
  const { error } = await session.supabase.rpc('set_primary_image', { p_image_id: imageId });
  if (error) return dbError(error, 'image');
  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true, message: 'Main photo updated.' };
}

export async function reorderImages(productId: string, orderedIds: string[]): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  if (!uuid.safeParse(productId).success || !z.array(uuid).max(50).safeParse(orderedIds).success) {
    return { error: 'Invalid order.' };
  }
  const { data: owned } = await session.supabase.from('product_images').select('id').eq('product_id', productId);
  const ownedIds = new Set((owned ?? []).map((o) => o.id));
  if (orderedIds.some((i) => !ownedIds.has(i))) return { error: 'Invalid order.' };
  const { error } = await session.supabase.rpc('reorder_rows', { p_table: 'product_images', p_ids: orderedIds });
  if (error) return dbError(error, 'image order');
  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true };
}

export async function updateImageAlt(imageId: string, alt: string): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const parsed = z.object({ id: uuid, alt: z.string().trim().max(200) }).safeParse({ id: imageId, alt });
  if (!parsed.success) return { error: 'Description must be under 200 characters.' };
  const { error } = await session.supabase
    .from('product_images')
    .update({ alt_text: parsed.data.alt || null })
    .eq('id', parsed.data.id);
  if (error) return dbError(error, 'image');
  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true, message: 'Photo description saved.' };
}

// ----------------------------------------------------- models & categories

const TABLES = { models: 'motorcycle_models', categories: 'product_categories' } as const;
type TaxonomyKind = keyof typeof TABLES;

export async function saveTaxonomy(kind: TaxonomyKind, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  if (!(kind in TABLES)) return { error: 'Invalid request.' };
  const parsed = taxonomyFromForm(formData);
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const { id, ...row } = parsed.data;
  const table = TABLES[kind];
  const label = kind === 'models' ? 'model' : 'category';
  const db = session.supabase;

  if (id) {
    const { error } = await db.from(table).update(row).eq('id', id);
    if (error) {
      return error.code === '23505' ? { error: `A ${label} with that name or URL already exists.` } : dbError(error, label);
    }
  } else {
    const { data: last } = await db.from(table).select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from(table).insert({ ...row, sort_order: (last?.sort_order ?? 0) + 10 });
    if (error) {
      return error.code === '23505' ? { error: `A ${label} with that name or URL already exists.` } : dbError(error, label);
    }
  }
  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true, message: id ? `${label[0].toUpperCase()}${label.slice(1)} saved.` : `${label[0].toUpperCase()}${label.slice(1)} added.` };
}

export async function moveTaxonomy(kind: TaxonomyKind, id: string, direction: 'up' | 'down'): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  if (!(kind in TABLES) || !uuid.safeParse(id).success) return { error: 'Invalid request.' };
  const table = TABLES[kind];
  const { data: rows, error } = await session.supabase.from(table).select('id').order('sort_order').order('name');
  if (error) return dbError(error, 'order');
  const ids = (rows ?? []).map((r) => r.id as string);
  const i = ids.indexOf(id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  const { error: rErr } = await session.supabase.rpc('reorder_rows', { p_table: table, p_ids: ids });
  if (rErr) return dbError(rErr, 'order');
  revalidateTag(TAG_CATALOG, { expire: 0 });
  return { ok: true };
}

// ----------------------------------------------------------------- settings

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const parsed = settingsFromForm(formData);
  if (!parsed.success) return { error: 'Please fix the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };
  const { data, error } = await session.supabase.from('business_settings').update(parsed.data).eq('id', 1).select('id');
  if (error) return dbError(error, 'settings');
  if (!data?.length) return { error: 'Settings row is missing. Run the database migrations.' };
  revalidateTag(TAG_SETTINGS, { expire: 0 });
  // Settings also appear in the statically rendered home page shell (banner, hero, number).
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Business details saved. The website now shows the updated information.' };
}

// ------------------------------------------------------------------ hero image

const HERO_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const MODEL_IMAGE_PATH = /^models\/[a-z0-9-]{8,64}\.(webp|jpg|png)$/;
const HERO_PATH = /^hero\/[a-z0-9-]{8,64}\.(webp|jpg|png)$/;

/**
 * Replace the one large image beside the home page heading. Only the previous
 * hero file (matched by its exact hero/ path) is removed; nothing else in the
 * storage bucket or the product photos is touched.
 */
export async function uploadHeroImage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image file first.' };
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return { error: 'Use a PNG, JPEG or WebP image.' };
  }
  if (file.size > HERO_IMAGE_MAX_BYTES) return { error: 'The image is larger than 3 MB. Please resize it and try again.' };

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `hero/${crypto.randomUUID()}.${ext}`;
  const db = session.supabase;

  // Send the raw bytes rather than the File object: some Storage-compatible
  // servers only accept raw request bodies.
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await db.storage
    .from('brand-images')
    .upload(path, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (uploadError) return { error: 'The image could not be uploaded. Please try again.' };

  const { data: before } = await db.from('business_settings').select('hero_image_path').eq('id', 1).maybeSingle();
  const { error } = await db.from('business_settings').update({ hero_image_path: path }).eq('id', 1);
  if (error) {
    await db.storage.from('brand-images').remove([path]);
    return dbError(error, 'home page image');
  }

  if (before?.hero_image_path && HERO_PATH.test(before.hero_image_path)) {
    await db.storage.from('brand-images').remove([before.hero_image_path]);
  }
  revalidateTag(TAG_SETTINGS, { expire: 0 });
  // Settings also appear in the statically rendered home page shell (banner, hero, number).
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Home page image updated. The website now shows it.' };
}

/**
 * Uploads a photograph for one motorcycle model. The picture replaces the
 * drawing on the "Shop by model" cards. The old file is removed only after the
 * new one is recorded.
 */
export async function uploadModelImage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;

  const modelId = uuid.safeParse(formData.get('model_id'));
  if (!modelId.success) return { error: 'Invalid model.' };

  const file = formData.get('image');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image file first.' };
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return { error: 'Use a PNG, JPEG or WebP image.' };
  }
  if (file.size > HERO_IMAGE_MAX_BYTES) return { error: 'The image is larger than 3 MB. Please resize it and try again.' };

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `models/${crypto.randomUUID()}.${ext}`;
  const db = session.supabase;

  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await db.storage
    .from('brand-images')
    .upload(path, bytes, { contentType: file.type, cacheControl: '31536000', upsert: false });
  if (uploadError) return { error: 'The image could not be uploaded. Please try again.' };

  const { data: before } = await db
    .from('motorcycle_models')
    .select('image_path')
    .eq('id', modelId.data)
    .maybeSingle();
  const { error } = await db.from('motorcycle_models').update({ image_path: path }).eq('id', modelId.data);
  if (error) {
    await db.storage.from('brand-images').remove([path]);
    return dbError(error, 'model picture');
  }

  if (before?.image_path && MODEL_IMAGE_PATH.test(before.image_path)) {
    await db.storage.from('brand-images').remove([before.image_path]);
  }
  revalidateTag(TAG_CATALOG, { expire: 0 });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Model picture updated. The website now shows it.' };
}

/** Puts a model card back to the drawn illustration. */
export async function removeModelImage(modelId: string): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;
  const id = uuid.safeParse(modelId);
  if (!id.success) return { error: 'Invalid model.' };
  const db = session.supabase;

  const { data: before } = await db.from('motorcycle_models').select('image_path').eq('id', id.data).maybeSingle();
  if (!before?.image_path) return { ok: true, message: 'This model already uses the drawing.' };

  const { error } = await db.from('motorcycle_models').update({ image_path: null }).eq('id', id.data);
  if (error) return dbError(error, 'model picture');
  if (MODEL_IMAGE_PATH.test(before.image_path)) {
    await db.storage.from('brand-images').remove([before.image_path]);
  }
  revalidateTag(TAG_CATALOG, { expire: 0 });
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Photo removed. The card shows the drawing again.' };
}

// ------------------------------------------------------------------ import

export type ImportResult = {
  error?: string;
  created?: number;
  results?: { line: number; name: string; outcome: 'created' | 'skipped' | 'error'; note?: string }[];
} | null;

/** Bulk-create products from a CSV file (owner's parts lists). Never overwrites. */
// ------------------------------------------------------- image storage

/** Saves the provider used for new uploads unless the admin overrides it. */
export async function saveDefaultImageProvider(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;

  const provider: ImageProvider | null = parseImageProvider(formData.get('default_image_provider'));
  if (!provider) return { error: 'Choose Supabase Storage or ImageKit.' };

  if (provider === 'imagekit' && !imageKitCredentials()) {
    return {
      error:
        'ImageKit is not configured on the server yet, so it cannot be the default. Add the ImageKit keys first.',
    };
  }

  const { error } = await session.supabase
    .from('business_settings')
    .update({ default_image_provider: provider })
    .eq('id', 1);
  if (error) return dbError(error, 'setting');

  revalidateTag(TAG_SETTINGS, { expire: 0 });
  return { ok: true, message: `New photos will be stored on ${PROVIDER_LABEL[provider]}.` };
}

/** Retries the files that could not be deleted from their provider earlier. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState always passes both arguments
export async function retryImageCleanup(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const session = await admin();
  if (!session) return NOT_AUTHORISED;

  const outcome = await processCleanupQueue(session.supabase);
  if (outcome.cleaned === 0 && outcome.failed === 0) return { ok: true, message: 'Nothing is waiting for cleanup.' };
  if (outcome.failed > 0) {
    return {
      ok: true,
      warning: `Deleted ${outcome.cleaned} file(s); ${outcome.failed} still could not be deleted. ${outcome.remaining} left in the queue.`,
    };
  }
  return { ok: true, message: `Deleted ${outcome.cleaned} leftover file(s). The queue is empty.` };
}

export async function importProducts(_prev: ImportResult, formData: FormData): Promise<ImportResult> {
  const session = await admin();
  if (!session) return { error: NOT_AUTHORISED!.error };
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file to import.' };
  if (file.size > 1024 * 1024) return { error: 'The file is larger than 1 MB. Split it into smaller files.' };
  if (!/\.csv$/i.test(file.name)) return { error: 'Please upload a .csv file (in Excel: File → Save As → CSV).' };

  const db = session.supabase;
  const [cats, mods, existing] = await Promise.all([
    db.from('product_categories').select('id, name, slug'),
    db.from('motorcycle_models').select('id, name, slug'),
    db.from('products').select('slug, part_number'),
  ]);
  if (cats.error || mods.error || existing.error) return { error: 'Could not read the catalogue. Please try again.' };

  const plan = planImport(await file.text(), cats.data ?? [], mods.data ?? []);
  const results: NonNullable<ImportResult>['results'] = plan.errors.map((e) => ({ line: e.line, name: '—', outcome: 'error' as const, note: e.message }));
  if (plan.errors.some((e) => e.line === 1)) return { error: plan.errors[0].message, results: [] };

  const takenSlugs = new Set((existing.data ?? []).map((p) => p.slug as string));
  const takenParts = new Set((existing.data ?? []).map((p) => (p.part_number as string | null)?.toLowerCase()).filter(Boolean));
  let created = 0;

  for (const row of plan.rows) {
    if (row.part_number && takenParts.has(row.part_number.toLowerCase())) {
      results.push({ line: row.line, name: row.name, outcome: 'skipped', note: `Part no. ${row.part_number} already exists` });
      continue;
    }
    const slug = uniqueSlug(row.slug, row.part_number, takenSlugs);
    const { data, error } = await db
      .from('products')
      .insert({
        name: row.name,
        slug,
        part_number: row.part_number,
        description: row.description,
        category_id: row.category_id,
        availability: row.availability,
        status: row.status,
        part_type: row.part_type,
      })
      .select('id')
      .single();
    if (error) {
      results.push({ line: row.line, name: row.name, outcome: 'error', note: error.code === '42501' ? 'Not authorised' : 'Could not save' });
      continue;
    }
    if (row.model_ids.length) {
      await db.rpc('set_product_models', { p_product_id: data.id, p_model_ids: row.model_ids });
    }
    if (row.part_number) takenParts.add(row.part_number.toLowerCase());
    created++;
    results.push({ line: row.line, name: row.name, outcome: 'created', note: row.warnings.join('; ') || undefined });
  }

  if (created) revalidateTag(TAG_CATALOG, { expire: 0 });
  results.sort((a, b) => a.line - b.line);
  return { created, results };
}
