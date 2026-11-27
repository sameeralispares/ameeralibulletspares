import { parseSupply, type Supply } from './part-types';
import { isAvailability, type Availability } from './types';
import { isValidSlug } from './slug';

export type CatalogParams = {
  q?: string;
  model?: string;
  category?: string;
  availability?: Availability;
  /** One supply only. Undefined shows every part. */
  partType?: Supply;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Parse + sanitise URL search params for the catalogue. Unknown values are dropped. */
export function parseCatalogParams(raw: RawParams): CatalogParams {
  const q = first(raw.q)?.replace(/\s+/g, ' ').trim().slice(0, 80) || undefined;
  const model = first(raw.model)?.trim().toLowerCase();
  const category = first(raw.category)?.trim().toLowerCase();
  const availability = first(raw.availability);
  const partType = parseSupply(first(raw.type)?.trim().toLowerCase());
  const pageNum = Number.parseInt(first(raw.page) ?? '1', 10);
  return {
    q,
    model: model && isValidSlug(model) ? model : undefined,
    category: category && isValidSlug(category) ? category : undefined,
    availability: isAvailability(availability) ? availability : undefined,
    partType: partType ?? undefined,
    page: Number.isFinite(pageNum) && pageNum > 0 && pageNum < 10000 ? pageNum : 1,
  };
}

/** Build a catalogue URL from params, omitting empty values and page 1. */
export function catalogHref(base: string, params: Partial<CatalogParams>): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.model) sp.set('model', params.model);
  if (params.category) sp.set('category', params.category);
  if (params.availability) sp.set('availability', params.availability);
  if (params.partType) sp.set('type', params.partType);
  if (params.page && params.page > 1) sp.set('page', String(params.page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

export function hasActiveFilters(p: Partial<CatalogParams>): boolean {
  return Boolean(p.q || p.model || p.category || p.availability || p.partType);
}
