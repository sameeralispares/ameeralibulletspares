import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv, planImport, uniqueSlug } from '@/lib/product-import';

const cats = [
  { id: 'c-engine', name: 'Engine Parts', slug: 'engine-parts' },
  { id: 'c-body', name: 'Body Parts', slug: 'body-parts' },
  { id: 'c-clutch', name: 'Clutch and Transmission', slug: 'clutch-and-transmission' },
  { id: 'c-susp', name: 'Suspension', slug: 'suspension' },
  { id: 'c-acc', name: 'Accessories', slug: 'accessories' },
  { id: 'c-brake', name: 'Braking System', slug: 'braking-system' },
  { id: 'c-other', name: 'Other Parts', slug: 'other-parts' },
];
const models = [
  { id: 'm-classic', name: 'Classic', slug: 'classic' },
  { id: 'm-electra', name: 'Electra', slug: 'electra' },
  { id: 'm-standard', name: 'Standard', slug: 'standard' },
  { id: 'm-tb', name: 'Thunderbird', slug: 'thunderbird' },
];

describe('CSV parsing', () => {
  it('handles quotes, commas, escaped quotes, CRLF and BOM', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([['a', 'b'], ['x, y', 'say "hi"']]);
  });
});

describe('import planning', () => {
  it('maps the shop parts list (data/shop-parts-2026-11.csv)', () => {
    const csv = fs.readFileSync(path.join(__dirname, '../../data/shop-parts-2026-11.csv'), 'utf8');
    const plan = planImport(csv, cats, models);
    expect(plan.errors).toEqual([]);
    expect(plan.rows).toHaveLength(13);
    for (const r of plan.rows) {
      expect(r.availability).toBe('contact_to_confirm');
      expect(r.status).toBe('published');
      expect(r.category_id).not.toBeNull();
      expect(r.warnings).toEqual([]);
    }
    const mc = plan.rows.find((r) => r.part_number === '594706/A')!;
    expect(mc.model_ids.sort()).toEqual(['m-classic', 'm-electra', 'm-standard']);
    expect(plan.rows.find((r) => r.part_number === '600004/A')!.model_ids).toEqual([]);
  });

  it('reports bad rows and unknown references without failing the file', () => {
    const plan = planImport('Name,Category,Models,Availability,Status\nX,Engine Parts,,,\nGood part,Nope,Classic;Moon,maybe,live\n', cats, models);
    expect(plan.errors).toEqual([{ line: 2, message: 'Name must be 2–140 characters.' }]);
    const r = plan.rows[0];
    expect(r.category_id).toBeNull();
    expect(r.model_ids).toEqual(['m-classic']);
    expect(r.availability).toBe('contact_to_confirm');
    expect(r.status).toBe('draft');
    expect(r.warnings).toHaveLength(4);
  });

  it('requires a name column', () => {
    expect(planImport('part_number\n123\n', cats, models).errors[0].message).toMatch(/name/);
  });

  it('creates unique slugs using the part number', () => {
    const taken = new Set(['inspection-cap']);
    expect(uniqueSlug('inspection-cap', '145251/D', taken)).toBe('inspection-cap-145251-d');
    expect(uniqueSlug('inspection-cap', null, taken)).toBe('inspection-cap-2');
  });
});
