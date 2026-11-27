'use client';

import { ShopImage } from '@/components/shop-image';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addProductImage,
  removeProductImage,
  reorderImages,
  setPrimaryImage,
  updateImageAlt,
  uploadProductImageToProvider,
} from '@/app/admin/(panel)/actions';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { PRODUCT_IMAGE_BUCKET } from '@/lib/supabase/env';
import { resolveImageSrc } from '@/lib/image-source';
import { PROVIDER_LABEL, PROVIDER_LIMITS, type ImageProvider } from '@/lib/image-providers';
import { ProviderPicker } from './provider-picker';
import { compressImage } from '@/lib/image-compress';
import { ALLOWED_UPLOAD_TYPES, MAX_SOURCE_FILE_BYTES, MAX_UPLOAD_BYTES } from '@/lib/validation';
import { buttonClasses } from '@/components/ui/button';
import { IconChevronDown, IconChevronUp, IconImage, IconStar, IconTrash } from '@/components/ui/icons';
import { ConfirmButton } from './confirm-dialog';
import type { ProductImage } from '@/lib/types';

type Upload = {
  key: string;
  name: string;
  progress: number;
  status: 'processing' | 'uploading' | 'saving' | 'done' | 'error';
  provider: ImageProvider;
  error?: string;
};

function uploadWithProgress(url: string, token: string, apiKey: string, blob: Blob, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', apiKey);
    xhr.setRequestHeader('content-type', blob.type);
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let msg = `Upload failed (${xhr.status})`;
      try {
        const body = JSON.parse(xhr.responseText);
        if (body.message) msg = body.message;
      } catch {}
      reject(new Error(msg));
    };
    xhr.onerror = () => reject(new Error('Network error — check your connection and try again.'));
    xhr.send(blob);
  });
}

export function ImageManager({
  productId,
  productName,
  images,
  defaultProvider,
  imagekitReady,
}: {
  productId: string;
  productName: string;
  images: ProductImage[];
  /** Saved default from the shop settings. */
  defaultProvider: ImageProvider;
  imagekitReady: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [notice, setNotice] = useState<{ error?: string; message?: string; warning?: string } | null>(null);
  const [pending, start] = useTransition();
  // Changing this picks the provider for the next upload only; the saved
  // default in Settings is untouched.
  const [provider, setProvider] = useState<ImageProvider>(defaultProvider);

  const sorted = [...images].sort((a, b) => a.sort_order - b.sort_order);

  function patch(key: string, p: Partial<Upload>) {
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...p } : u)));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setNotice(null);
    // The provider chosen when the files were picked is used for this whole
    // batch, so changing it mid-upload cannot split a batch in two.
    const target = provider;

    let token: string | undefined;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (target === 'supabase') {
      const supabase = getBrowserSupabase();
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData.session?.access_token;
      if (!token || !url || !apiKey) {
        setNotice({ error: 'Your session has expired. Please sign in again.' });
        return;
      }
    }

    const list = Array.from(files).slice(0, 12);
    const queued: Upload[] = list.map((f) => ({
      key: crypto.randomUUID(),
      name: f.name,
      progress: 0,
      status: 'processing',
      provider: target,
    }));
    setUploads((u) => [...u, ...queued]);

    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const { key } = queued[i];
      try {
        if (file.type && !(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
          throw new Error('Only JPG, PNG, WebP or HEIC photos can be uploaded.');
        }
        if (file.size > MAX_SOURCE_FILE_BYTES) throw new Error('This photo is larger than 15 MB.');
        const compressed = await compressImage(file);
        const limit = Math.min(MAX_UPLOAD_BYTES, PROVIDER_LIMITS[target].maxBytes);
        if (compressed.blob.size > limit) throw new Error('This photo is still too large after compression.');
        const mimeType = compressed.blob.type === 'image/png' ? 'image/png' : compressed.blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';

        if (target === 'imagekit') {
          // Goes through the website server, which holds the ImageKit key.
          patch(key, { status: 'uploading', progress: 50 });
          const body = new FormData();
          body.set('productId', productId);
          body.set('provider', 'imagekit');
          body.set('file', new File([compressed.blob], `photo.${compressed.ext}`, { type: mimeType }));
          const res = await uploadProductImageToProvider(body);
          if (res?.error) throw new Error(res.error);
        } else {
          const path = `products/${productId}/${crypto.randomUUID()}.${compressed.ext}`;
          patch(key, { status: 'uploading' });
          await uploadWithProgress(
            `${url}/storage/v1/object/${PRODUCT_IMAGE_BUCKET}/${path}`,
            token!,
            apiKey!,
            compressed.blob,
            (p) => patch(key, { progress: p }),
          );
          patch(key, { status: 'saving', progress: 100 });
          const res = await addProductImage({
            productId,
            path,
            width: compressed.width,
            height: compressed.height,
            fileSize: compressed.blob.size,
            mimeType,
          });
          if (res?.error) throw new Error(res.error);
        }
        patch(key, { status: 'done', progress: 100 });
      } catch (err) {
        patch(key, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
    router.refresh();
    setTimeout(() => setUploads((u) => u.filter((x) => x.status !== 'done')), 1500);
  }

  function run(fn: () => Promise<{ error?: string; message?: string; warning?: string } | null>) {
    start(async () => {
      const res = await fn();
      setNotice(
        res?.error
          ? { error: res.error }
          : res?.warning
            ? { warning: res.warning }
            : res?.message
              ? { message: res.message }
              : null,
      );
      router.refresh();
    });
  }

  function move(index: number, dir: -1 | 1) {
    const ids = sorted.map((i) => i.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    run(() => reorderImages(productId, ids));
  }

  return (
    <section aria-labelledby="photos-heading" className="space-y-4 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="photos-heading" className="text-lg font-bold uppercase">Photos</h2>
          <p className="mt-1 text-sm text-stone-600">Use real photos of the genuine part. The ★ photo is shown first. Photos are resized automatically.</p>
        </div>
        <label className={buttonClasses('dark', 'md', 'cursor-pointer w-full sm:w-auto')}>
          <IconImage /> Add photos
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            data-testid="image-input"
          />
        </label>
      </div>

      <div className="rounded-md border border-graphite-900/10 bg-ivory-100/60 p-3 sm:p-4">
        <ProviderPicker
          value={provider}
          onChange={setProvider}
          imagekitReady={imagekitReady}
          footnote={
            provider === defaultProvider
              ? `This is the saved default. Change the default under Settings → Image storage.`
              : `Just for the next upload. The saved default is ${PROVIDER_LABEL[defaultProvider]}.`
          }
        />
      </div>

      {notice && (
        <p
          role={notice.error ? 'alert' : 'status'}
          className={`text-sm font-medium ${notice.error ? 'text-stop-700' : notice.warning ? 'text-bronze-700' : 'text-ok-700'}`}
        >
          {notice.error ?? notice.warning ?? notice.message}
        </p>
      )}

      {uploads.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} className="rounded-md border border-graphite-900/10 p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="truncate font-medium">{u.name}</span>
                <span className={u.status === 'error' ? 'text-stop-700' : 'text-stone-600'}>
                  {u.status === 'processing' && 'Optimising…'}
                  {u.status === 'uploading' && (u.provider === 'imagekit' ? 'Uploading to ImageKit…' : `${u.progress}%`)}
                  {u.status === 'saving' && 'Saving…'}
                  {u.status === 'done' && 'Done'}
                  {u.status === 'error' && 'Failed'}
                </span>
              </div>
              {u.status !== 'error' ? (
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory-200"
                  role="progressbar"
                  aria-valuenow={u.provider === 'imagekit' && u.status === 'uploading' ? undefined : u.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uploading ${u.name}`}
                >
                  <div
                    className={`h-full bg-bronze-500 transition-[width] ${u.provider === 'imagekit' && u.status === 'uploading' ? 'animate-pulse' : ''}`}
                    style={{ width: `${u.status === 'processing' ? 5 : u.progress}%` }}
                  />
                </div>
              ) : (
                <p className="mt-1 text-stop-700">{u.error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-md border border-dashed border-graphite-900/20 bg-ivory-100/60 p-8 text-center text-sm text-stone-600">
          No photos yet. Tap <strong>Add photos</strong> to choose from your phone gallery or camera.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-3" aria-busy={pending}>
          {sorted.map((img, i) => {
            const src = resolveImageSrc(img);
            return (
              <li key={img.id} className={`overflow-hidden rounded-md border ${img.is_primary ? 'border-bronze-500 ring-1 ring-bronze-500' : 'border-graphite-900/15'}`}>
                <div className="relative aspect-[4/3] bg-ivory-100">
                  {src && <ShopImage src={src} alt={img.alt_text || productName} fill sizes="(min-width:1024px) 280px, 50vw" className="object-contain p-2" />}
                  {img.is_primary && (
                    <span className="absolute left-2 top-2 rounded bg-ink px-2 py-0.5 text-xs font-semibold text-bronze-300">★ Main photo</span>
                  )}
                  <span
                    className="absolute bottom-2 right-2 rounded bg-white/90 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-stone-700"
                    data-testid="image-provider-badge"
                  >
                    {PROVIDER_LABEL[img.storage_provider]}
                  </span>
                </div>
                <div className="space-y-2 p-2.5">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const alt = String(new FormData(e.currentTarget).get('alt') ?? '');
                      run(() => updateImageAlt(img.id, alt));
                    }}
                    className="flex gap-2"
                  >
                    <label htmlFor={`alt-${img.id}`} className="sr-only">Photo description</label>
                    <input
                      id={`alt-${img.id}`}
                      name="alt"
                      defaultValue={img.alt_text ?? ''}
                      maxLength={200}
                      placeholder="Describe photo (for Google)"
                      className="min-h-11 min-w-0 flex-1 rounded border border-graphite-900/20 px-2 text-sm focus:border-bronze-500 focus:outline-none"
                    />
                    <button type="submit" className="min-h-11 rounded border border-graphite-900/20 px-3 text-sm font-semibold hover:border-graphite-900">
                      Save
                    </button>
                  </form>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={img.is_primary || pending}
                      onClick={() => run(() => setPrimaryImage(img.id))}
                      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded border border-graphite-900/15 px-2 text-sm font-medium disabled:opacity-50"
                    >
                      <IconStar width={16} height={16} /> {img.is_primary ? 'Main' : 'Make main'}
                    </button>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || pending} aria-label="Move photo earlier" className="grid h-11 w-11 place-items-center rounded border border-graphite-900/15 disabled:opacity-40">
                      <IconChevronUp />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === sorted.length - 1 || pending} aria-label="Move photo later" className="grid h-11 w-11 place-items-center rounded border border-graphite-900/15 disabled:opacity-40">
                      <IconChevronDown />
                    </button>
                    <ConfirmButton
                      title="Remove this photo?"
                      description="The photo will be deleted permanently."
                      confirmLabel="Remove photo"
                      onConfirm={() => run(() => removeProductImage(img.id))}
                      triggerLabel={<IconTrash />}
                      triggerAriaLabel="Remove photo"
                      triggerClassName="grid h-11 w-11 place-items-center rounded border border-stop-700/30 text-stop-700 hover:bg-stop-50"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
