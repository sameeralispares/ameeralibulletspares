'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { IconFilter, IconSearch } from '@/components/ui/icons';
import { AVAILABILITY_OPTIONS } from '@/lib/types';
import type { CatalogParams } from '@/lib/catalog-params';

type Option = { slug: string; name: string };

/**
 * Plain GET form, so search and filters work even before JavaScript loads.
 * With JS, dropdown changes apply instantly without a full page reload.
 */
export function CatalogFilters({
  action,
  params,
  models,
  categories,
  hideModel = false,
}: {
  action: string;
  params: CatalogParams;
  models: Option[];
  categories: Option[];
  hideModel?: boolean;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const activeCount = [params.model && !hideModel, params.category, params.availability].filter(Boolean).length;
  const [showFilters, setShowFilters] = useState(activeCount > 0);

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const sp = new URLSearchParams();
    for (const [k, v] of new FormData(form).entries()) {
      if (typeof v === 'string' && v.trim()) sp.set(k, v.trim());
    }
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${action}?${qs}` : action, { scroll: false }));
  }

  const selectCls =
    'h-12 w-full appearance-none rounded-md border border-graphite-900/20 bg-white bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%235f5a51%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-[position:right_0.75rem_center] bg-no-repeat pl-3 pr-9 text-[0.9375rem] text-ink focus:border-bronze-500 focus:outline-none';

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      role="search"
      aria-label="Search and filter parts"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      className="rounded-[var(--radius-plate)] border border-graphite-900/10 bg-ivory-100 p-3 sm:p-4"
      aria-busy={pending}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor="catalogue-search" className="sr-only">
            Search parts by name or part number
          </label>
          <input
            id="catalogue-search"
            name="q"
            type="search"
            defaultValue={params.q ?? ''}
            enterKeyHint="search"
            maxLength={80}
            placeholder="Search parts or part number…"
            className="h-12 w-full rounded-md border border-graphite-900/20 bg-white pl-11 pr-3 text-[0.9375rem] placeholder:text-stone-500 focus:border-bronze-500 focus:outline-none"
          />
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
        </div>
        <button
          type="submit"
          className="min-h-12 rounded-md bg-graphite-900 px-4 font-display text-sm font-semibold uppercase tracking-[0.1em] text-ivory-50 hover:bg-graphite-800"
        >
          Search
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowFilters((v) => !v)}
        aria-expanded={showFilters}
        aria-controls="catalogue-filters"
        className="mt-2 flex min-h-11 w-full items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.1em] text-stone-600 sm:hidden"
      >
        <IconFilter width={18} height={18} /> {showFilters ? 'Hide filters' : 'Show filters'}
        {activeCount > 0 && (
          <span className="ml-auto rounded-full bg-bronze-500 px-2 py-0.5 text-xs text-ink">{activeCount} active</span>
        )}
      </button>
      <div
        id="catalogue-filters"
        className={`filters-panel mt-3 gap-3 ${showFilters ? 'grid' : 'hidden'} sm:grid ${hideModel ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}
      >
        {!hideModel && (
          <div>
            <label htmlFor="filter-model" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-stone-600">
              Motorcycle model
            </label>
            <select id="filter-model" name="model" defaultValue={params.model ?? ''} onChange={apply} className={selectCls}>
              <option value="">All models</option>
              {models.map((m) => (
                <option key={m.slug} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="filter-category" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-stone-600">
            Part category
          </label>
          <select
            id="filter-category"
            name="category"
            defaultValue={params.category ?? ''}
            onChange={apply}
            className={selectCls}
            disabled={categories.length === 0}
          >
            <option value="">{categories.length ? 'All categories' : 'No categories yet'}</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-availability" className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-stone-600">
            Availability
          </label>
          <select
            id="filter-availability"
            name="availability"
            defaultValue={params.availability ?? ''}
            onChange={apply}
            className={selectCls}
          >
            <option value="">Any availability</option>
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <noscript>
        <style>{'.filters-panel{display:grid!important}'}</style>
      </noscript>
      <noscript>
        <p className="mt-2 text-xs text-stone-600">Choose filters, then press Search.</p>
      </noscript>
    </form>
  );
}
