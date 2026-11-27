import Link from 'next/link';
import { EmptyState } from '@/components/ui/primitives';
import { IconBox, IconSearch } from '@/components/ui/icons';
import { CatalogFilters } from './catalog-filters';
import { PartTypeTabs } from './part-type-tabs';
import { Pagination } from './pagination';
import { ProductGrid } from './product-card';
import { EnquiryActions } from '@/components/site/enquiry';
import { catalogTypeCounts, getBusinessSettings, getCategoriesInUse, getModels, searchCatalog } from '@/lib/data/catalog';
import { catalogHref, hasActiveFilters, parseCatalogParams } from '@/lib/catalog-params';
import { availabilityLabel } from '@/lib/types';

type RawSearchParams = Record<string, string | string[] | undefined>;

/**
 * Search box + filters + result grid. Reads searchParams, so it must be
 * rendered inside <Suspense>.
 */
export async function CatalogResults({
  searchParams,
  basePath,
  fixedModel,
}: {
  searchParams: Promise<RawSearchParams>;
  basePath: string;
  fixedModel?: { slug: string; name: string };
}) {
  const raw = await searchParams;
  const params = parseCatalogParams(raw);
  if (fixedModel) params.model = fixedModel.slug;

  const [result, models, categories, settings] = await Promise.all([
    searchCatalog({ ...params }),
    getModels(),
    getCategoriesInUse(),
    getBusinessSettings(),
  ]);

  // A tab with no matches returns no rows, so its counts come separately.
  const typeCounts =
    result.items.length > 0 || !params.partType ? result.typeCounts : await catalogTypeCounts({ ...params });

  const modelName = fixedModel?.name ?? models.find((m) => m.slug === params.model)?.name;
  const categoryName = categories.find((c) => c.slug === params.category)?.name;
  const filtersActive = hasActiveFilters({ ...params, model: fixedModel ? undefined : params.model });

  const chips: { label: string; href: string }[] = [];
  const without = (k: 'q' | 'model' | 'category' | 'availability' | 'partType') =>
    catalogHref(basePath, { ...params, model: fixedModel ? undefined : params.model, [k]: undefined, page: 1 });
  if (params.q) chips.push({ label: `“${params.q}”`, href: without('q') });
  if (params.model && !fixedModel) chips.push({ label: modelName ?? params.model, href: without('model') });
  if (params.category) chips.push({ label: categoryName ?? params.category, href: without('category') });
  if (params.availability) chips.push({ label: availabilityLabel(params.availability), href: without('availability') });

  return (
    <div>
      <CatalogFilters
        key={JSON.stringify(params)}
        action={basePath}
        params={params}
        models={models.map((m) => ({ slug: m.slug, name: m.name }))}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        hideModel={Boolean(fixedModel)}
      />

      <div className="mt-5">
        <PartTypeTabs
          active={params.partType}
          counts={typeCounts}
          hrefFor={(type) =>
            catalogHref(basePath, {
              ...params,
              model: fixedModel ? undefined : params.model,
              partType: type,
              page: 1,
            })
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2" aria-live="polite">
        <p className="mr-2 text-sm text-stone-600">
          <span className="font-semibold text-ink">{result.total}</span> {result.total === 1 ? 'part' : 'parts'}
          {modelName ? ` for ${modelName}` : ''}
        </p>
        {chips.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            scroll={false}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-graphite-900 px-3 text-sm text-ivory-50 hover:bg-graphite-700"
            aria-label={`Remove filter ${c.label}`}
          >
            {c.label} <span aria-hidden="true">×</span>
          </Link>
        ))}
        {filtersActive && (
          <Link href={basePath} scroll={false} className="inline-flex min-h-9 items-center px-2 text-sm font-semibold text-bronze-700 underline underline-offset-4">
            Clear all
          </Link>
        )}
      </div>

      <div className="mt-5">
        {result.items.length ? (
          <>
            <ProductGrid supply={params.partType} items={result.items} priorityCount={2} />
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              hrefFor={(p) => catalogHref(basePath, { ...params, model: fixedModel ? undefined : params.model, page: p })}
            />
          </>
        ) : filtersActive ? (
          <EmptyState
            icon={<IconSearch />}
            title="No matching parts listed"
            actions={
              <>
                <Link href={basePath} className="inline-flex min-h-12 items-center px-4 font-display font-semibold uppercase tracking-[0.08em] text-bronze-700 underline underline-offset-4">
                  Clear filters
                </Link>
                <EnquiryActions settings={settings} context={{ modelName: modelName ?? null }} showCall />
              </>
            }
          >
            Not every part we stock is online yet. Ask us — we&apos;ll check the shop for you.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<IconBox />}
            title={modelName ? `${modelName} parts are being listed` : 'Parts are being listed'}
            actions={<EnquiryActions settings={settings} context={{ modelName: modelName ?? null }} />}
          >
            We haven&apos;t added these parts to the website yet. Tell us what you need and we&apos;ll check
            availability for you.
          </EmptyState>
        )}
      </div>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse">
      <div className="h-[8.5rem] rounded-[var(--radius-plate)] bg-ivory-200/70 sm:h-[9.5rem]" />
      <div className="mt-6 h-5 w-32 rounded bg-ivory-200" />
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 rounded-[var(--radius-plate)] bg-ivory-200/60 sm:h-80" />
        ))}
      </div>
    </div>
  );
}
