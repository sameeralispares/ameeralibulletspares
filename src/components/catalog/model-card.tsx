import { ShopImage } from '@/components/shop-image';
import Link from 'next/link';
import { ModelArt } from './model-art';
import { brandImageUrl } from '@/lib/supabase/env';

export type ModelWithCount = {
  id: string;
  name: string;
  slug: string;
  productCount: number;
  oemCount?: number;
  vendorCount?: number;
  /** Photo uploaded by the shop; falls back to the drawing when null. */
  image_path?: string | null;
};

/**
 * Model tiles show the shop's own photograph of the motorcycle when one has
 * been uploaded, and otherwise an original drawing of that style of bike. No
 * manufacturer photography is used.
 */
export function ModelCard({ model, index, tone = 'light' }: { model: ModelWithCount; index: number; tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  const num = String(index + 1).padStart(2, '0');
  const photo = model.image_path ? brandImageUrl(model.image_path) : null;
  const vendor = model.vendorCount ?? 0;
  const oem = model.oemCount ?? 0;

  return (
    <Link
      href={`/models/${model.slug}`}
      className={`group relative flex flex-col overflow-hidden rounded-[var(--radius-plate)] border transition-colors ${
        dark
          ? 'border-white/10 bg-graphite-900 hover:border-bronze-500/70 hover:bg-graphite-800'
          : 'border-graphite-900/12 bg-white hover:border-bronze-500 shadow-[var(--shadow-plate)]'
      }`}
    >
      <span
        className={`relative flex aspect-[16/9] items-center justify-center overflow-hidden ${
          dark ? 'bg-graphite-800' : 'bg-ivory-100'
        }`}
      >
        {photo ? (
          <ShopImage
            src={photo}
            alt=""
            fill
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
            className="object-cover"
          />
        ) : (
          <ModelArt
            slug={model.slug}
            className={`h-full w-full p-2 transition-transform duration-300 group-hover:scale-[1.04] ${
              dark ? 'text-ivory-200/70' : 'text-stone-500'
            }`}
          />
        )}
        <span className={`absolute left-2 top-2 font-mono text-[0.6875rem] ${dark ? 'text-ivory-200/45' : 'text-stone-400'}`}>
          {num}
        </span>
      </span>

      <span className="flex flex-1 items-end justify-between gap-2 p-3 sm:p-4">
        <span className="min-w-0">
          <span
            className={`block truncate font-display text-lg font-bold uppercase leading-tight tracking-[0.03em] sm:text-xl ${
              dark ? 'text-ivory-50' : 'text-ink'
            }`}
          >
            {model.name}
          </span>
          <span className={`mt-1 block text-xs font-medium ${dark ? 'text-bronze-300' : 'text-bronze-700'}`}>
            {model.productCount > 0
              ? vendor > 0
                ? `${oem} OEM · ${vendor} vendor`
                : `${model.productCount} ${model.productCount === 1 ? 'part' : 'parts'} listed`
              : 'Ask us about parts'}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm transition-transform group-hover:translate-x-0.5 ${
            dark ? 'border-white/15 text-bronze-300' : 'border-graphite-900/15 text-bronze-700'
          }`}
        >
          →
        </span>
      </span>
    </Link>
  );
}

export function ModelGrid({ models, tone = 'light' }: { models: ModelWithCount[]; tone?: 'light' | 'dark' }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="model-grid">
      {models.map((m, i) => (
        <li key={m.id}>
          <ModelCard model={m} index={i} tone={tone} />
        </li>
      ))}
    </ul>
  );
}
