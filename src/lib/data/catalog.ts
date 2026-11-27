import 'server-only';
import { providerOf } from '@/lib/image-providers';
import { partTypeOf, type Supply } from '@/lib/part-types';
import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/public';
import { CONFIRMED_BUSINESS } from '@/lib/site';
import { activeFestiveOffer, priceFor, supplyPrices } from '@/lib/pricing';
import type {
  Availability,
  BusinessSettings,
  CatalogItem,
  MotorcycleModel,
  ProductCategory,
  ProductDetail,
} from '@/lib/types';

/**
 * PUBLIC read layer. Each cached read uses unstable_cache with a tag, so admin
 * changes refresh the website immediately via revalidateTag(tag, { expire: 0 }),
 * with a 5-minute revalidation safety net.
 *
 * Cache Components is off (see next.config.ts), so reads use unstable_cache
 * rather than the 'use cache' directive.
 *
 * Errors are thrown (not swallowed) so a failing database never produces a
 * page that falsely claims "no products".
 */

export const TAG_CATALOG = 'catalog';
export const TAG_SETTINGS = 'settings';

export const PAGE_SIZE = 24;

const CATALOG_REVALIDATE_SECONDS = 300;

/** Wraps a read in unstable_cache: cached per arguments, tagged, 5-minute safety net. */
function cached<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  keyParts: string[],
  tags: string[],
) {
  return unstable_cache(fn, keyParts, { tags, revalidate: CATALOG_REVALIDATE_SECONDS });
}

function fail(context: string, error: { message: string }): never {
  throw new Error(`[catalog] ${context}: ${error.message}`);
}

export const getBusinessSettings = cached(
  async (): Promise<BusinessSettings> => {
    const db = createPublicClient();
    if (!db) return CONFIRMED_BUSINESS;
    const { data, error } = await db
      .from('business_settings')
      .select(
        'business_name, address, landline, whatsapp_number, email, opening_hours, google_maps_url, facebook_url, instagram_url, youtube_url, about_intro, about_history, hero_image_path, festive_active, festive_label, festive_discount_type, festive_discount_value, default_image_provider',
      )
      .eq('id', 1)
      .maybeSingle();
    if (error) fail('business settings', error);
    return data ?? CONFIRMED_BUSINESS;
  },
  ['business-settings'],
  [TAG_SETTINGS],
);

export const getModels = cached(
  async (): Promise<MotorcycleModel[]> => {
    const db = createPublicClient();
    if (!db) return [];
    const { data, error } = await db
      .from('motorcycle_models')
      .select('id, name, slug, description, sort_order, is_active, image_path')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) fail('models', error);
    return data ?? [];
  },
  ['models'],
  [TAG_CATALOG],
);

export const getCategories = cached(
  async (): Promise<ProductCategory[]> => {
    const db = createPublicClient();
    if (!db) return [];
    const { data, error } = await db
      .from('product_categories')
      .select('id, name, slug, description, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');
    if (error) fail('categories', error);
    return data ?? [];
  },
  ['categories'],
  [TAG_CATALOG],
);

/** Published products for one model or category, split OEM / vendor. */
export type PublishedCount = { total: number; oem: number; vendor: number };

export type PublishedCounts = {
  models: Record<string, PublishedCount>;
  categories: Record<string, PublishedCount>;
  total: number;
};

type CountRow = { kind: string; ref_id: string; product_count: number; oem_count: number; vendor_count: number };

export const getPublishedCounts = cached(
  async (): Promise<PublishedCounts> => {
    const db = createPublicClient();
    const out: PublishedCounts = { models: {}, categories: {}, total: 0 };
    if (!db) return out;
    const [{ data, error }, totalRes] = await Promise.all([
      db.rpc('published_counts'),
      db.from('products').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    ]);
    if (error) fail('counts', error);
    if (totalRes.error) fail('total count', totalRes.error);
    for (const row of (data ?? []) as CountRow[]) {
      const bucket = row.kind === 'model' ? out.models : out.categories;
      bucket[row.ref_id] = {
        total: Number(row.product_count),
        oem: Number(row.oem_count ?? 0),
        vendor: Number(row.vendor_count ?? 0),
      };
    }
    out.total = totalRes.count ?? 0;
    return out;
  },
  ['published-counts'],
  [TAG_CATALOG],
);

/** Models with their real published product counts, split OEM / vendor. */
export async function getModelsWithCounts() {
  const [models, counts] = await Promise.all([getModels(), getPublishedCounts()]);
  return models.map((m) => ({ ...m, ...splitCount(counts.models[m.id]) }));
}

/** Only categories that actually contain published products are shown publicly. */
export async function getCategoriesInUse() {
  const [categories, counts] = await Promise.all([getCategories(), getPublishedCounts()]);
  return categories
    .map((c) => ({ ...c, ...splitCount(counts.categories[c.id]) }))
    .filter((c) => c.productCount > 0);
}

function splitCount(count: PublishedCount | undefined) {
  return {
    productCount: count?.total ?? 0,
    oemCount: count?.oem ?? 0,
    vendorCount: count?.vendor ?? 0,
  };
}

export async function getModelBySlug(slug: string): Promise<MotorcycleModel | null> {
  const models = await getModels();
  return models.find((m) => m.slug === slug) ?? null;
}

export type CatalogQuery = {
  q?: string;
  model?: string;
  category?: string;
  availability?: Availability;
  featured?: boolean;
  /** One supply only. Undefined shows every part. */
  partType?: Supply;
  page?: number;
  pageSize?: number;
};

/** Row as returned by catalog_search(): numeric columns arrive as strings or numbers. */
type RawCatalogRow = Omit<CatalogItem, 'mrp' | 'offer_price' | 'pricing' | 'total_count' | 'vendor_mrp' | 'vendor_offer_price' | 'supplyPricing'> & {
  mrp: number | string | null;
  offer_price: number | string | null;
  total_count: number | string;
  all_total: number | string;
  oem_total: number | string;
  vendor_total: number | string;
  vendor_mrp: number | string | null;
  vendor_offer_price: number | string | null;
};

function toRupees(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type CatalogResult = {
  items: CatalogItem[];
  total: number;
  page: number;
  pageCount: number;
  /**
   * How many OEM and vendor parts match the same filters, ignoring the
   * part-type filter, so the tabs can show both counts.
   */
  typeCounts: { all: number; oem: number; vendor: number };
};

export const searchCatalog = cached(
  async (query: CatalogQuery): Promise<CatalogResult> => {
    const pageSize = Math.min(Math.max(query.pageSize ?? PAGE_SIZE, 1), 60);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const db = createPublicClient();
    if (!db) return { items: [], total: 0, page, pageCount: 0, typeCounts: { all: 0, oem: 0, vendor: 0 } };
    const { data, error } = await db.rpc('catalog_search', {
      p_query: query.q?.slice(0, 80) || null,
      p_model: query.model || null,
      p_category: query.category || null,
      p_availability: query.availability ?? null,
      p_featured: query.featured ?? null,
      p_part_type: query.partType ?? null,
      p_limit: pageSize,
      p_offset: (page - 1) * pageSize,
    });
    if (error) fail('search', error);
    const festive = activeFestiveOffer(await getBusinessSettings());
    const items = ((data ?? []) as unknown as RawCatalogRow[]).map((r) => {
      const mrp = toRupees(r.mrp);
      const offer_price = toRupees(r.offer_price);
      return {
        id: r.id,
        name: r.name,
        slug: r.slug,
        part_number: r.part_number,
        availability: r.availability,
        is_featured: r.is_featured,
        mrp,
        offer_price,
        pricing: priceFor({ mrp, offer_price }, festive),
        category_name: r.category_name,
        category_slug: r.category_slug,
        image_path: r.image_path,
        image_alt: r.image_alt,
        image_width: r.image_width,
        image_height: r.image_height,
        image_provider: providerOf(r.image_provider),
        image_url: r.image_url ?? null,
        part_type: partTypeOf(r.part_type),
        vendor_mrp: toRupees(r.vendor_mrp),
        vendor_offer_price: toRupees(r.vendor_offer_price),
        supplyPricing: supplyPrices(
          {
            part_type: partTypeOf(r.part_type),
            mrp,
            offer_price,
            vendor_mrp: toRupees(r.vendor_mrp),
            vendor_offer_price: toRupees(r.vendor_offer_price),
          },
          festive,
        ),
        total_count: Number(r.total_count),
      } satisfies CatalogItem;
    });
    const total = items[0]?.total_count ?? 0;
    const raw = (data ?? []) as unknown as RawCatalogRow[];
    const typeCounts = {
      all: Number(raw[0]?.all_total ?? 0),
      oem: Number(raw[0]?.oem_total ?? 0),
      vendor: Number(raw[0]?.vendor_total ?? 0),
    };
    return { items, total, page, pageCount: Math.ceil(total / pageSize), typeCounts };
  },
  ['catalog-search'],
  [TAG_CATALOG],
);

/**
 * Total, OEM and vendor counts for a set of filters. A tab with no results
 * returns no rows at all, so the counts are fetched without the part-type
 * filter. A part held from both supplies counts once in `all` and once in
 * each of `oem` and `vendor`, so the two tabs can add up to more than `all`.
 */
export async function catalogTypeCounts(query: CatalogQuery): Promise<{ all: number; oem: number; vendor: number }> {
  const { typeCounts } = await searchCatalog({ ...query, partType: undefined, page: 1, pageSize: 1 });
  return typeCounts;
}

/**
 * Product detail. Cached and tagged with TAG_CATALOG, so repeat views are
 * served from cache but any admin change (edit, archive, hide, delete — each
 * calls revalidateTag(TAG_CATALOG, { expire: 0 })) takes effect immediately.
 * A 5-minute revalidation is the safety net. Keyed by slug.
 */
export const getProductBySlug = cached(
  async (slug: string): Promise<ProductDetail | null> => {
    const db = createPublicClient();
    if (!db) return null;
    const { data, error } = await db
      .from('products')
      .select(
        `id, name, slug, part_number, description, availability, is_featured, seo_title, seo_description, updated_at, mrp, offer_price, part_type, vendor_mrp, vendor_offer_price,
         category:product_categories ( id, name, slug, is_active ),
         images:product_images ( id, storage_path, alt_text, width, height, sort_order, is_primary, storage_provider, image_url ),
         compat:product_model_compatibility ( model:motorcycle_models ( id, name, slug, sort_order, is_active ) )`,
      )
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) fail(`product ${slug}`, error);
    if (!data) return null;

    type Raw = {
      id: string;
      name: string;
      slug: string;
      part_number: string | null;
      description: string | null;
      availability: Availability;
      is_featured: boolean;
      seo_title: string | null;
      seo_description: string | null;
      updated_at: string;
      mrp: number | string | null;
      offer_price: number | string | null;
      part_type: string | null;
      vendor_mrp: number | string | null;
      vendor_offer_price: number | string | null;
      category: { id: string; name: string; slug: string; is_active: boolean } | null;
      images: ProductDetail['images'];
      compat: { model: { id: string; name: string; slug: string; sort_order: number; is_active: boolean } | null }[];
    };
    const raw = data as unknown as Raw;

    const images = [...(raw.images ?? [])].sort(
      (a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order,
    );
    const models = (raw.compat ?? [])
      .map((c) => c.model)
      .filter((m): m is NonNullable<typeof m> => Boolean(m && m.is_active))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(({ id, name, slug: s }) => ({ id, name, slug: s }));

    const mrp = toRupees(raw.mrp);
    const offer_price = toRupees(raw.offer_price);
    const vendorMrp = toRupees(raw.vendor_mrp);
    const vendorOffer = toRupees(raw.vendor_offer_price);
    const festive = activeFestiveOffer(await getBusinessSettings());

    return {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      part_number: raw.part_number,
      description: raw.description,
      availability: raw.availability,
      is_featured: raw.is_featured,
      seo_title: raw.seo_title,
      seo_description: raw.seo_description,
      updated_at: raw.updated_at,
      mrp,
      offer_price,
      pricing: priceFor({ mrp, offer_price }, festive),
      part_type: partTypeOf(raw.part_type),
      vendor_mrp: vendorMrp,
      vendor_offer_price: vendorOffer,
      supplyPricing: supplyPrices(
        { part_type: partTypeOf(raw.part_type), mrp, offer_price, vendor_mrp: vendorMrp, vendor_offer_price: vendorOffer },
        festive,
      ),
      category: raw.category?.is_active ? { id: raw.category.id, name: raw.category.name, slug: raw.category.slug } : null,
      images,
      models,
    };
  },
  ['product-by-slug'],
  [TAG_CATALOG],
);

/** Related products: same category first, then same model. Excludes the product itself. */
export async function getRelatedProducts(product: ProductDetail, limit = 4): Promise<CatalogItem[]> {
  const seen = new Set<string>([product.id]);
  const out: CatalogItem[] = [];
  const add = (items: CatalogItem[]) => {
    for (const it of items) {
      if (out.length >= limit) return;
      if (!seen.has(it.id)) {
        seen.add(it.id);
        out.push(it);
      }
    }
  };
  if (product.category) {
    add((await searchCatalog({ category: product.category.slug, pageSize: limit + 1 })).items);
  }
  for (const m of product.models) {
    if (out.length >= limit) break;
    add((await searchCatalog({ model: m.slug, pageSize: limit + 1 })).items);
  }
  return out;
}

/** For the sitemap: all published product slugs + last modified time. */
export const getPublishedProductIndex = cached(
  async (): Promise<{ slug: string; updated_at: string }[]> => {
    const db = createPublicClient();
    if (!db) return [];
    const out: { slug: string; updated_at: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db
        .from('products')
        .select('slug, updated_at')
        .eq('status', 'published')
        .order('updated_at', { ascending: false })
        .range(from, from + 999);
      if (error) fail('sitemap index', error);
      out.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    return out;
  },
  ['published-product-index'],
  [TAG_CATALOG],
);
