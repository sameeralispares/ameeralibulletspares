'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { ShopImage } from '@/components/shop-image';
import Link from 'next/link';
import { removeModelImage, uploadModelImage, type ActionState } from '@/app/admin/(panel)/actions';
import { ModelArt } from '@/components/catalog/model-art';
import { compressImage } from '@/lib/image-compress';
import { brandImageUrl } from '@/lib/supabase/env';
import { Button, buttonClasses } from '@/components/ui/button';
import { FormAlert } from './form';

export type AdminModel = {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  image_path: string | null;
  productCount: number;
  oemCount: number;
  vendorCount: number;
};

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
/** The card shows the picture at about 300px wide, so this is plenty. */
const MODEL_IMAGE_MAX_EDGE = 900;

/**
 * One card per motorcycle model: its picture, how many OEM and vendor
 * parts are listed for it, and a link to those parts.
 */
export function ModelGalleryAdmin({ models }: { models: AdminModel[] }) {
  return (
    <section aria-labelledby="model-pictures-heading" className="mb-8">
      <h2 id="model-pictures-heading" className="font-display text-lg font-bold uppercase">
        Parts and pictures by model
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        Each card links to the parts listed for that model. Upload a photograph to replace the drawing — use a photo the
        shop has taken itself, not one from the internet.
      </p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="model-gallery">
        {models.map((model) => (
          <li key={model.id}>
            <ModelPictureCard model={model} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ModelPictureCard({ model }: { model: AdminModel }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(uploadModelImage, null);
  const [removeState, setRemoveState] = useState<ActionState>(null);
  const [optimising, setOptimising] = useState(false);
  const [removing, setRemoving] = useState(false);
  const photo = model.image_path ? brandImageUrl(model.image_path) : null;
  const notice = state ?? removeState;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const file = fd.get('image');
    if (file instanceof File && file.size > 0 && IMAGE_TYPES.includes(file.type)) {
      setOptimising(true);
      try {
        const c = await compressImage(file, { maxEdge: MODEL_IMAGE_MAX_EDGE });
        fd.set('image', new File([c.blob], `model.${c.ext}`, { type: c.blob.type }));
      } catch {
        // Keep the original; the server still checks the type and size.
      } finally {
        setOptimising(false);
      }
    }
    startTransition(() => action(fd));
  }

  async function onRemove() {
    setRemoving(true);
    setRemoveState(await removeModelImage(model.id));
    setRemoving(false);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/12 bg-white">
      <div className="relative flex aspect-[16/9] items-center justify-center bg-ivory-100">
        {photo ? (
          <ShopImage src={photo} alt={`${model.name} photo`} fill sizes="(min-width: 1024px) 30vw, 45vw" className="object-cover" />
        ) : (
          <ModelArt slug={model.slug} className="h-full w-full p-2 text-stone-500" />
        )}
        {!model.is_active && (
          <span className="absolute left-2 top-2 rounded bg-ink px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase text-ivory-200">
            Hidden
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="font-display text-lg font-bold uppercase leading-tight">{model.name}</p>
          <p className="mt-0.5 text-sm text-stone-600" data-testid={`model-counts-${model.slug}`}>
            {model.productCount === 0
              ? 'No parts listed yet'
              : `${model.oemCount} OEM · ${model.vendorCount} vendor`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/products?model=${model.slug}`} className={buttonClasses('outline', 'sm')}>
            View parts
          </Link>
          {model.vendorCount > 0 && (
            <Link href={`/admin/products?model=${model.slug}&type=vendor`} className={buttonClasses('ghost', 'sm')}>
              Vendor only
            </Link>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-auto flex flex-wrap items-center gap-2 border-t border-graphite-900/10 pt-3">
          <input type="hidden" name="model_id" value={model.id} />
          <label className="flex-1">
            <span className="sr-only">Photo for {model.name}</span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              required
              className="w-full text-sm file:mr-2 file:min-h-10 file:rounded-md file:border-0 file:bg-ivory-200 file:px-3 file:font-semibold"
            />
          </label>
          <Button type="submit" variant="dark" size="sm" disabled={pending || optimising}>
            {optimising ? 'Optimising…' : pending ? 'Uploading…' : 'Upload'}
          </Button>
          {photo && (
            <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={removing}>
              {removing ? 'Removing…' : 'Use drawing'}
            </Button>
          )}
        </form>

        {notice?.error && <FormAlert error={notice.error} />}
        {notice?.message && <FormAlert message={notice.message} />}
      </div>
    </div>
  );
}
