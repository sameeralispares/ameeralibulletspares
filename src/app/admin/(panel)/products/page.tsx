import { ShopImage } from '@/components/shop-image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { AdminPageHeader, Card, StatusBadge } from '@/components/admin/page-header';
import { AvailabilityQuickSelect, FeaturedToggle } from '@/components/admin/quick-actions';
import { FormAlert } from '@/components/admin/form';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';
import { IconBox, IconPlus, IconSearch } from '@/components/ui/icons';
import { Pagination } from '@/components/catalog/pagination';
import { resolveImageSrc } from '@/lib/image-source';
import { PART_TYPES, PART_TYPE_LABEL, parsePartType, partTypeOf } from '@/lib/part-types';
import { PartTypeBadge } from '@/components/catalog/part-type-tabs';
import { AVAILABILITY_OPTIONS, isAvailability, type Availability } from '@/lib/types';

export const metadata: Metadata = { title: 'Products' };

const PER_PAGE = 30;
const STATUS_FILTERS = [
  { value: '', label: 'All (not archived)' },
  { value: 'published', label: 'Published' },
  { value: 'unpublished', label: 'Draft & hidden' },
  { value: 'archived', label: 'Archived' },
];

type Row = {
  id: string;
  name: string;
  part_number: string | null;
  status: string;
  availability: Availability;
  is_featured: boolean;
  category: { name: string } | null;
  part_type: string | null;
  product_images: { storage_path: string; is_primary: boolean; sort_order: number; storage_provider: string | null; image_url: string | null }[];
};

function str(v: string | string[] | undefined) {
  return typeof v === 'string' ? v : '';
}

export default async function AdminProductsPage(props: PageProps<'/admin/products'>) {
  const { supabase } = await requireAdmin();
  const sp = await props.searchParams;
  const q = str(sp.q).replace(/[,()*%\\"']/g, ' ').trim().slice(0, 60);
  const status = str(sp.status);
  const availability = str(sp.availability);
  const featured = str(sp.featured) === '1';
  const missingPhotos = str(sp.photos) === 'missing';
  const partType = parsePartType(str(sp.type));
  const modelSlug = str(sp.model).trim().toLowerCase().slice(0, 60);
  const page = Math.max(1, Number.parseInt(str(sp.page) || '1', 10) || 1);

  const { data: modelOptions } = await supabase
    .from('motorcycle_models')
    .select('id, name, slug')
    .order('sort_order');
  const activeModel = modelSlug ? (modelOptions ?? []).find((m) => m.slug === modelSlug) : undefined;

  const imagesEmbed = missingPhotos
    ? 'product_images!left ( storage_path, is_primary, sort_order, storage_provider, image_url )'
    : 'product_images ( storage_path, is_primary, sort_order, storage_provider, image_url )';
  let query = supabase
    .from('products')
    .select(`id, name, part_number, status, availability, is_featured, part_type, category:product_categories ( name ), ${imagesEmbed}`, {
      count: 'exact',
    })
    .order('updated_at', { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);

  if (status === 'published' || status === 'archived') query = query.eq('status', status);
  else if (status === 'unpublished') query = query.in('status', ['draft', 'hidden']);
  else query = query.neq('status', 'archived');
  if (isAvailability(availability)) query = query.eq('availability', availability);
  if (featured) query = query.eq('is_featured', true);
  if (missingPhotos) query = query.is('product_images', null);
  if (partType) query = query.eq('part_type', partType);
  if (activeModel) {
    const { data: compat } = await supabase
      .from('product_model_compatibility')
      .select('product_id')
      .eq('model_id', activeModel.id);
    query = query.in('id', (compat ?? []).map((c) => c.product_id));
  }
  if (q) query = query.or(`name.ilike.%${q}%,part_number.ilike.%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const filtered = Boolean(q || status || availability || featured || missingPhotos || partType || activeModel);

  const hrefFor = (p: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q,
      status,
      availability,
      featured: featured ? '1' : '',
      photos: missingPhotos ? 'missing' : '',
      type: partType ?? '',
      model: activeModel?.slug ?? '',
    })) {
      if (v) u.set(k, v);
    }
    if (p > 1) u.set('page', String(p));
    const s = u.toString();
    return s ? `/admin/products?${s}` : '/admin/products';
  };

  return (
    <>
      {sp.deleted ? (
        <div className="mb-4">
          <FormAlert
            message={
              sp.orphans
                ? `Product deleted, but ${sp.orphans} photo file(s) could not be removed from their storage provider. They are queued for cleanup under Settings → Image storage.`
                : 'Product deleted.'
            }
          />
        </div>
      ) : null}
      <AdminPageHeader
        title="Products"
        intro={`${total} ${total === 1 ? 'product' : 'products'}${filtered ? ' match these filters' : ''}. Change availability straight from this list.`}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <ButtonLink href="/admin/products/import" variant="outline" className="w-full sm:w-auto">
              Import CSV
            </ButtonLink>
            <ButtonLink href="/admin/products/new" className="w-full sm:w-auto">
              <IconPlus /> Add product
            </ButtonLink>
          </div>
        }
      />

      <form method="get" className="mb-5 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" role="search">
        <div className="relative">
          <label htmlFor="admin-q" className="sr-only">Search products</label>
          <input
            id="admin-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Search name or part number"
            className="min-h-12 w-full rounded-md border border-graphite-900/20 bg-white pl-10 pr-3 focus:border-bronze-500 focus:outline-none"
          />
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
        </div>
        <label htmlFor="admin-status" className="sr-only">Status</label>
        <select id="admin-status" name="status" defaultValue={status} className="min-h-12 rounded-md border border-graphite-900/20 bg-white px-3">
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <label htmlFor="admin-model" className="sr-only">Motorcycle model</label>
        <select id="admin-model" name="model" defaultValue={activeModel?.slug ?? ''} className="min-h-12 rounded-md border border-graphite-900/20 bg-white px-3">
          <option value="">Any model</option>
          {(modelOptions ?? []).map((m) => (
            <option key={m.id} value={m.slug}>{m.name}</option>
          ))}
        </select>
        <label htmlFor="admin-type" className="sr-only">OEM or vendor stock</label>
        <select id="admin-type" name="type" defaultValue={partType ?? ''} className="min-h-12 rounded-md border border-graphite-900/20 bg-white px-3">
          <option value="">OEM and vendor</option>
          {PART_TYPES.map((t) => (
            <option key={t} value={t}>{PART_TYPE_LABEL[t]} stock only</option>
          ))}
        </select>
        <label htmlFor="admin-availability" className="sr-only">Availability</label>
        <select id="admin-availability" name="availability" defaultValue={availability} className="min-h-12 rounded-md border border-graphite-900/20 bg-white px-3">
          <option value="">Any availability</option>
          {AVAILABILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className="min-h-12 rounded-md bg-graphite-900 px-5 font-display font-semibold uppercase tracking-[0.08em] text-ivory-50">
          Filter
        </button>
      </form>
      {activeModel && (
        <p className="mb-4 text-sm text-stone-600">
          Parts that fit the <span className="font-semibold text-ink">{activeModel.name}</span>
          {partType ? ` · ${PART_TYPE_LABEL[partType]} only` : ''} ·{' '}
          <Link href="/admin/models" className="font-semibold underline underline-offset-4">Back to models</Link>
        </p>
      )}
      {(featured || missingPhotos) && (
        <p className="mb-4 text-sm text-stone-600">
          Showing {featured ? 'featured products' : 'products without photos'} ·{' '}
          <Link href="/admin/products" className="font-semibold underline underline-offset-4">Show all</Link>
        </p>
      )}

      {error ? (
        <FormAlert error="Could not load products. Please refresh the page." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<IconBox />}
          title={filtered ? 'No products match' : 'No products yet'}
          actions={
            filtered ? (
              <ButtonLink href="/admin/products" variant="outline">Clear filters</ButtonLink>
            ) : (
              <ButtonLink href="/admin/products/new"><IconPlus /> Add your first product</ButtonLink>
            )
          }
        >
          {filtered ? 'Try a different search or filter.' : 'Add genuine parts with photos, compatible models and availability.'}
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-graphite-900/10">
            {rows.map((p) => {
              const img = [...p.product_images].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0];
              const src = resolveImageSrc(img);
              return (
                <li key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Link href={`/admin/products/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-graphite-900/10 bg-ivory-100">
                      {src ? (
                        <ShopImage src={src} alt="" fill sizes="64px" className="object-contain p-1" />
                      ) : (
                        <span className="grid h-full place-items-center text-[0.625rem] font-semibold uppercase text-stone-500">No photo</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink hover:underline">{p.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                        <StatusBadge status={p.status} />
                        <PartTypeBadge type={partTypeOf(p.part_type)} />
                        {p.category?.name && <span>{p.category.name}</span>}
                        {p.part_number && <span className="font-mono">#{p.part_number}</span>}
                      </span>
                    </span>
                  </Link>
                  <div className="flex items-start gap-2 sm:items-center">
                    <div className="flex-1 sm:flex-none">
                      <AvailabilityQuickSelect id={p.id} value={p.availability} name={p.name} />
                    </div>
                    <FeaturedToggle id={p.id} value={p.is_featured} name={p.name} />
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="inline-flex min-h-11 items-center rounded-md border border-graphite-900/15 px-3 text-sm font-semibold hover:border-graphite-900"
                    >
                      Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PER_PAGE)} hrefFor={hrefFor} />
    </>
  );
}
