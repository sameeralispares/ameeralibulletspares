'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { ShopImage } from '@/components/shop-image';
import { uploadHeroImage, type ActionState } from '@/app/admin/(panel)/actions';
import { compressImage } from '@/lib/image-compress';
import { FormAlert, SubmitButton } from './form';

const MAX_MB = 3;
/** The hero is shown at under 600px on the largest screens, so 1024px keeps it sharp. */
const HERO_MAX_EDGE = 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Replaces only the large image beside the home page heading. Nothing else on
 * the site uses it, and uploading a new one removes only the previous hero file.
 */
export function HeroImageForm({ currentUrl, shopName }: { currentUrl: string | null; shopName: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadHeroImage, null);
  const [optimising, setOptimising] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  /**
   * Compress in the browser first: a 6 MB phone photo becomes a sharp ~100 KB
   * WebP, so the home page loads faster. Non-image files are passed through so
   * the server can refuse them with its usual message.
   */
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('image');
    setNote(null);
    if (file instanceof File && file.size > 0 && IMAGE_TYPES.includes(file.type)) {
      setOptimising(true);
      try {
        const c = await compressImage(file, { maxEdge: HERO_MAX_EDGE, keepTransparency: true });
        fd.set('image', new File([c.blob], `hero.${c.ext}`, { type: c.blob.type }));
        setNote(`Optimised from ${formatMB(file.size)} to ${formatKB(c.blob.size)}.`);
      } catch {
        // Keep the original file; the server applies the size and type checks.
      } finally {
        setOptimising(false);
      }
    }
    startTransition(() => action(fd));
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-bold uppercase">Home page image</h2>
        <p className="mt-1 text-sm text-stone-600">
          The large picture beside “Genuine Royal Enfield spare parts” on the home page. Use a square PNG, JPEG or WebP
          image, up to {MAX_MB} MB. Uploading a new one replaces only this picture.
        </p>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="grid h-40 w-40 shrink-0 place-items-center overflow-hidden rounded-md bg-graphite-950 p-2">
          {currentUrl ? (
            <ShopImage src={currentUrl} alt={`${shopName} home page image`} width={160} height={160} className="h-full w-full object-contain" unoptimized />
          ) : (
            <span className="text-center text-xs text-ivory-200">The shop logo is shown until you upload an image.</span>
          )}
        </div>
        <div className="flex-1 space-y-4">
          <FormAlert error={state?.error} message={state?.message} />
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            required
            className="block min-h-11 w-full text-sm file:mr-4 file:min-h-11 file:rounded-md file:border-0 file:bg-graphite-900 file:px-4 file:font-semibold file:text-ivory-50"
          />
          {note && <p className="text-sm text-stone-600">{note}</p>}
          <SubmitButton pending={pending || optimising} className="w-full sm:w-auto">
            {optimising ? 'Optimising image…' : 'Upload new image'}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function formatMB(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatKB(bytes: number) {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
