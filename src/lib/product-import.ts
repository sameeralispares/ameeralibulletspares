import type { PartType } from './part-types';
import { slugify } from './slug';
import { isAvailability, type Availability, type ProductStatus } from './types';

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export type Lookup = { id: string; name: string; slug: string };

export type ImportRow = {
  line: number;
  name: string;
  slug: string;
  part_number: string | null;
  description: string | null;
  category_id: string | null;
  availability: Availability;
  status: ProductStatus;
  part_type: PartType;
  model_ids: string[];
  warnings: string[];
};

export type ImportPlan = { rows: ImportRow[]; errors: { line: number; message: string }[] };

// Which supply the stock came from. Every part is genuine either way, so
// these are sourcing words, not quality words.
const PART_TYPE_WORDS: Record<string, PartType> = {
  oem: 'oem',
  'oem stock': 'oem',
  direct: 'oem',
  company: 'oem',
  both: 'both',
  'oem and vendor': 'both',
  'oem & vendor': 'both',
  vendor: 'vendor',
  'vendor stock': 'vendor',
  'vendor part': 'vendor',
  supplier: 'vendor',
  outside: 'vendor',
};

const AVAIL_WORDS: Record<string, Availability> = {
  available: 'available',
  'in stock': 'available',
  'out of stock': 'out_of_stock',
  out_of_stock: 'out_of_stock',
  'contact to confirm': 'contact_to_confirm',
  contact_to_confirm: 'contact_to_confirm',
};

function norm(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function findRef(list: Lookup[], value: string): Lookup | undefined {
  const v = norm(value);
  return list.find((x) => norm(x.name) === v || x.slug === slugify(value));
}

export const MAX_IMPORT_ROWS = 500;

/**
 * Turn CSV text into validated product rows. Pure function: duplicate checks
 * against the database happen in the server action.
 * Columns (any order, case-insensitive): name*, part_number, category, models
 * (separated by ; or |), availability, status (draft|published), description,
 * type (oem|vendor|both — which supply the stock came from, defaults to oem).
 */
export function planImport(csv: string, categories: Lookup[], models: Lookup[]): ImportPlan {
  const table = parseCsv(csv);
  const errors: ImportPlan['errors'] = [];
  if (table.length < 2) return { rows: [], errors: [{ line: 1, message: 'The file has no data rows.' }] };
  const header = table[0].map((h) => norm(h).replace(/[\s-]+/g, '_'));
  const col = (k: string) => header.indexOf(k);
  if (col('name') < 0) return { rows: [], errors: [{ line: 1, message: 'Missing required column "name".' }] };
  if (table.length - 1 > MAX_IMPORT_ROWS) {
    return { rows: [], errors: [{ line: 1, message: `Too many rows (max ${MAX_IMPORT_ROWS} per file).` }] };
  }

  const rows: ImportRow[] = [];
  table.slice(1).forEach((cells, i) => {
    const line = i + 2;
    const get = (k: string) => (col(k) >= 0 ? (cells[col(k)] ?? '').trim() : '');
    const warnings: string[] = [];
    const name = get('name').replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 140) {
      errors.push({ line, message: 'Name must be 2–140 characters.' });
      return;
    }
    const part = get('part_number');
    if (part.length > 60) {
      errors.push({ line, message: 'Part number is longer than 60 characters.' });
      return;
    }
    const description = get('description');
    if (description.length > 5000) {
      errors.push({ line, message: 'Description is longer than 5000 characters.' });
      return;
    }

    let category_id: string | null = null;
    const catText = get('category');
    if (catText) {
      const c = findRef(categories, catText);
      if (c) category_id = c.id;
      else warnings.push(`Unknown category “${catText}” — left blank`);
    }

    const model_ids: string[] = [];
    for (const m of get('models').split(/[;|]/).map((x) => x.trim()).filter(Boolean)) {
      const ref = findRef(models, m);
      if (ref && !model_ids.includes(ref.id)) model_ids.push(ref.id);
      else if (!ref) warnings.push(`Unknown model “${m}” — skipped`);
    }

    const availText = norm(get('availability'));
    let availability: Availability = 'contact_to_confirm';
    if (availText) {
      const a = AVAIL_WORDS[availText] ?? (isAvailability(availText) ? availText : undefined);
      if (a) availability = a;
      else warnings.push(`Unknown availability “${get('availability')}” — set to Contact to Confirm`);
    }

    // "type" column: OEM stock unless the sheet says vendor.
    const typeText = norm(get('type')) || norm(get('part_type'));
    let part_type: PartType = 'oem';
    if (typeText) {
      const mapped = PART_TYPE_WORDS[typeText];
      if (mapped) part_type = mapped;
      else warnings.push(`Unknown type “${get('type') || get('part_type')}” — saved as OEM`);
    }

    const statusText = norm(get('status'));
    const status: ProductStatus = statusText === 'published' ? 'published' : 'draft';
    if (statusText && !['published', 'draft'].includes(statusText)) warnings.push(`Unknown status — saved as draft`);

    rows.push({
      line,
      name,
      slug: slugify(name),
      part_number: part || null,
      description: description || null,
      category_id,
      availability,
      status,
      part_type,
      model_ids,
      warnings,
    });
  });
  return { rows, errors };
}

/** Make a slug unique against a set of taken slugs (mutates the set). */
export function uniqueSlug(base: string, partNumber: string | null, taken: Set<string>): string {
  const root = base || 'part';
  let candidate = root;
  if (taken.has(candidate) && partNumber) candidate = `${root}-${slugify(partNumber)}`.slice(0, 120).replace(/-+$/, '');
  let n = 2;
  while (taken.has(candidate)) candidate = `${root}-${n++}`;
  taken.add(candidate);
  return candidate;
}
