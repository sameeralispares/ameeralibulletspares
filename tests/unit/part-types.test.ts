import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PART_TYPE,
  PART_TYPES,
  PART_TYPE_LABEL,
  PART_TYPE_LONG_LABEL,
  SUPPLIES,
  isPartType,
  parsePartType,
  parseSupply,
  partTypeOf,
  suppliesOf,
} from '@/lib/part-types';
import { catalogHref, parseCatalogParams } from '@/lib/catalog-params';
import { modelArtStyle } from '@/components/catalog/model-art';
import { buildOrderMessage, parseStoredCart, type CartLine } from '@/lib/cart';
import { planImport } from '@/lib/product-import';

describe('part types', () => {
  it('has three listing types and defaults to OEM', () => {
    expect([...PART_TYPES]).toEqual(['oem', 'vendor', 'both']);
    expect(DEFAULT_PART_TYPE).toBe('oem');
    // Every option is genuine stock, so no label implies a copy.
    expect(PART_TYPE_LABEL).toEqual({ oem: 'OEM', vendor: 'Vendor', both: 'OEM & Vendor' });
    expect(PART_TYPE_LONG_LABEL).toEqual({ oem: 'OEM only', vendor: 'Vendor only', both: 'Both' });
  });

  it('keeps the two supplies a customer can buy separate from the listing types', () => {
    expect([...SUPPLIES]).toEqual(['oem', 'vendor']);
    expect(suppliesOf('oem')).toEqual(['oem']);
    expect(suppliesOf('vendor')).toEqual(['vendor']);
    expect(suppliesOf('both')).toEqual(['oem', 'vendor']);
  });

  it('never accepts "both" as the supply on a cart line', () => {
    expect(parseSupply('oem')).toBe('oem');
    expect(parseSupply('vendor')).toBe('vendor');
    expect(parseSupply('both')).toBeNull();
  });

  it('rejects anything that is not a listing type', () => {
    expect(parsePartType('oem')).toBe('oem');
    expect(parsePartType('vendor')).toBe('vendor');
    expect(parsePartType('both')).toBe('both');
    for (const junk of ['OEM', 'genuine', '', ' vendor', null, undefined, 1, {}]) {
      expect(parsePartType(junk)).toBeNull();
    }
    expect(isPartType('aftermarket')).toBe(false);
  });

  it('treats a missing value on an older row as OEM', () => {
    expect(partTypeOf(undefined)).toBe('oem');
    expect(partTypeOf(null)).toBe('oem');
    expect(partTypeOf('nonsense')).toBe('oem');
    expect(partTypeOf('vendor')).toBe('vendor');
    expect(partTypeOf('both')).toBe('both');
  });
});

describe('catalogue URL parameters', () => {
  it('reads the type filter and drops an unknown one', () => {
    expect(parseCatalogParams({ type: 'vendor' }).partType).toBe('vendor');
    expect(parseCatalogParams({ type: 'OEM' }).partType).toBe('oem');
    expect(parseCatalogParams({ type: 'cheap' }).partType).toBeUndefined();
    expect(parseCatalogParams({}).partType).toBeUndefined();
  });

  it('round-trips through the catalogue link', () => {
    expect(catalogHref('/models/bullet', { partType: 'vendor', page: 1 })).toBe('/models/bullet?type=vendor');
    expect(catalogHref('/models/bullet', { partType: undefined, page: 1 })).toBe('/models/bullet');
    const href = catalogHref('/products', { q: 'clutch', partType: 'oem', page: 2 });
    expect(href).toContain('type=oem');
    expect(href).toContain('page=2');
  });
});

describe('model drawings', () => {
  it('gives every seeded model a drawing', () => {
    const seeded = [
      'bullet',
      'classic',
      'electra',
      'thunderbird',
      'standard',
      'meteor-350',
      'hunter-350',
      'himalayan',
      'scram',
      'interceptor-650',
      'continental-gt-650',
      'other-newer-models',
    ];
    for (const slug of seeded) {
      expect(['classic', 'cruiser', 'street', 'adventure', 'cafe', 'twin']).toContain(modelArtStyle(slug));
    }
  });

  it('matches the body style to the motorcycle', () => {
    expect(modelArtStyle('bullet')).toBe('classic');
    expect(modelArtStyle('meteor-350')).toBe('cruiser');
    expect(modelArtStyle('himalayan')).toBe('adventure');
    expect(modelArtStyle('continental-gt-650')).toBe('cafe');
    expect(modelArtStyle('interceptor-650')).toBe('twin');
  });

  it('falls back to the classic for a model the shop adds later', () => {
    expect(modelArtStyle('bullet-650-2029')).toBe('classic');
    expect(modelArtStyle('')).toBe('classic');
  });
});

describe('orders name which supply each part came from', () => {
  const details = { name: 'Asif', mobile: '98765 43210', address: '', motorcycle: '', note: '' };
  const line = (id: string, partType: 'oem' | 'vendor'): CartLine => ({
    productId: id,
    slug: `part-${id}`,
    name: `Part ${id}`,
    partNumber: `PN-${id}`,
    unitPrice: 500,
    partType,
    qty: 1,
  });

  it('names the supply on each line so the shop picks the right stock', () => {
    const msg = buildOrderMessage([line('a', 'oem'), line('b', 'vendor')], details);
    expect(msg).toContain('Part a (part no. PN-a) [OEM] × 1');
    expect(msg).toContain('Part b (part no. PN-b) [Vendor] × 1');
  });

  it('reads a cart saved before the supply was recorded as OEM', () => {
    const saved = JSON.stringify([
      { productId: 'a', slug: 'a', name: 'Part a', partNumber: null, unitPrice: 100, qty: 2 },
    ]);
    expect(parseStoredCart(saved)).toEqual([
      { productId: 'a', slug: 'a', name: 'Part a', partNumber: null, unitPrice: 100, partType: 'oem', qty: 2 },
    ]);
  });

  it('ignores a tampered supply rather than rejecting the whole cart', () => {
    const saved = JSON.stringify([
      { productId: 'a', slug: 'a', name: 'Part a', partNumber: null, unitPrice: 100, partType: 'free', qty: 1 },
    ]);
    expect(parseStoredCart(saved)[0]?.partType).toBe('oem');
  });
});

describe('CSV import', () => {
  const models = [{ id: '11111111-2222-4333-8444-555555555555', name: 'Bullet', slug: 'bullet' }];
  const categories = [{ id: '22222222-3333-4444-8555-666666666666', name: 'Engine Parts', slug: 'engine-parts' }];

  const plan = (csv: string) => planImport(csv, categories, models);

  it('defaults to OEM when the sheet has no type column', () => {
    const { rows, errors } = plan('name,part_number\nClutch plate,CP-1\n');
    expect(errors).toHaveLength(0);
    expect(rows[0].part_type).toBe('oem');
  });

  it('understands the sourcing words a shop would type', () => {
    const { rows } = plan('name,type\nPart A,vendor\nPart B,Direct\nPart C,supplier\nPart D,OEM\nPart E,company\n');
    expect(rows.map((r) => r.part_type)).toEqual(['vendor', 'oem', 'vendor', 'oem', 'oem']);
  });

  it('warns and falls back to OEM for a word it does not know', () => {
    const { rows } = plan('name,type\nPart A,cheapo\n');
    expect(rows[0].part_type).toBe('oem');
    expect(rows[0].warnings.join(' ')).toContain('cheapo');
  });
});
