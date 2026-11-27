import { describe, expect, it } from 'vitest';
import {
  buildEnquiryMessage,
  buildPartShareMessage,
  buildWhatsAppShareUrl,
  buildWhatsAppUrl,
  mapsUrl,
  normaliseWhatsAppNumber,
  telHref,
  toE164India,
} from '@/lib/contact';
import { isValidSlug, slugify } from '@/lib/slug';
import { catalogHref, hasActiveFilters, parseCatalogParams } from '@/lib/catalog-params';
import { isValidImagePath, productFromForm, settingsFromForm, taxonomyFromForm } from '@/lib/validation';
import { fitWithin } from '@/lib/image-compress';
import { safeAdminPath } from '@/lib/auth-paths';

describe('phone numbers', () => {
  it('formats the confirmed landline as E.164', () => {
    expect(toE164India('044 2841 5241')).toBe('+914428415241');
    expect(telHref('044 2841 5241')).toBe('tel:+914428415241');
    expect(toE164India('+91 44 2841 5241')).toBe('+914428415241');
    expect(toE164India('12')).toBeNull();
    expect(telHref(null)).toBeNull();
  });

  it('normalises WhatsApp numbers to wa.me digits', () => {
    expect(normaliseWhatsAppNumber('+91 98765 43210')).toBe('919876543210');
    expect(normaliseWhatsAppNumber('98765 43210')).toBe('919876543210');
    expect(normaliseWhatsAppNumber('098765 43210')).toBe('919876543210');
    expect(normaliseWhatsAppNumber('919876543210')).toBe('919876543210');
    expect(normaliseWhatsAppNumber('')).toBeNull();
    expect(normaliseWhatsAppNumber('abc')).toBeNull();
    expect(normaliseWhatsAppNumber(null)).toBeNull();
  });

  it('uses the shop number for both the landline and WhatsApp', () => {
    expect(normaliseWhatsAppNumber('+91 96770 93315')).toBe('919677093315');
    expect(buildWhatsAppUrl('+91 96770 93315', 'Hi')).toBe('https://wa.me/919677093315?text=Hi');
    expect(telHref('+91 96770 93315')).toBe('tel:+919677093315');
  });
});

describe('WhatsApp enquiry', () => {
  it('builds the product message from the brief', () => {
    expect(buildEnquiryMessage({ productName: 'Clutch Plate', modelName: 'Classic' })).toBe(
      'Hello, I am enquiring about Clutch Plate for Classic. Is this genuine part currently available?',
    );
    expect(buildEnquiryMessage({ productName: 'Clutch Plate', partNumber: 'RE123' })).toContain('(part no. RE123)');
    expect(buildEnquiryMessage({ modelName: 'Bullet' })).toContain('my Bullet');
    expect(buildEnquiryMessage()).toContain('genuine Royal Enfield spare parts');
  });

  it('URL-encodes the message', () => {
    const url = buildWhatsAppUrl('+91 98765 43210', 'Hi & is "this" 100% genuine? #1')!;
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Hi & is "this" 100% genuine? #1');
    expect(url).not.toContain(' ');
    expect(url).not.toContain('&is');
  });

  it('never returns a broken link', () => {
    expect(buildWhatsAppUrl(null, 'x')).toBeNull();
    expect(buildWhatsAppUrl('', 'x')).toBeNull();
    expect(buildWhatsAppUrl('123', 'x')).toBeNull();
  });
});

describe('maps link', () => {
  it('prefers the owner-verified URL', () => {
    expect(mapsUrl({ verifiedUrl: 'https://maps.app.goo.gl/abc', name: 'Shop', address: 'X' })).toBe('https://maps.app.goo.gl/abc');
  });
  it('falls back to a documented Google Maps search URL without coordinates', () => {
    const u = mapsUrl({ name: 'S Ameer Ali', address: 'Old 25, Wheelers Market' })!;
    expect(u).toBe('https://www.google.com/maps/search/?api=1&query=S%20Ameer%20Ali%2C%20Old%2025%2C%20Wheelers%20Market');
    expect(mapsUrl({ verifiedUrl: 'javascript:alert(1)', name: 'S', address: null })).toBeNull();
  });
});

describe('slugs', () => {
  it('slugifies part names', () => {
    expect(slugify('Clutch Plate (Set of 5)')).toBe('clutch-plate-set-of-5');
    expect(slugify('  Meteor 350 — Brake & Shoe  ')).toBe('meteor-350-brake-and-shoe');
    expect(slugify('Other / Newer Models')).toBe('other-newer-models');
    expect(slugify('!!!')).toBe('');
  });
  it('validates slugs', () => {
    expect(isValidSlug('continental-gt-650')).toBe(true);
    expect(isValidSlug('Bad Slug')).toBe(false);
    expect(isValidSlug('double--hyphen')).toBe(false);
    expect(isValidSlug('-leading')).toBe(false);
  });
});

describe('catalogue URL params', () => {
  it('parses and sanitises', () => {
    expect(parseCatalogParams({ q: '  clutch   plate ', model: 'Classic', availability: 'available', page: '2' })).toEqual({
      q: 'clutch plate', model: 'classic', category: undefined, availability: 'available', page: 2,
    });
    const bad = parseCatalogParams({ model: '../etc', availability: 'maybe', page: '-4', category: ['a', 'b'] });
    expect(bad).toEqual({ q: undefined, model: undefined, category: 'a', availability: undefined, page: 1 });
    expect(parseCatalogParams({ q: 'x'.repeat(500) }).q).toHaveLength(80);
  });
  it('builds clean URLs', () => {
    expect(catalogHref('/products', { q: 'brake pad', page: 1 })).toBe('/products?q=brake+pad');
    expect(catalogHref('/products', { model: 'bullet', page: 3 })).toBe('/products?model=bullet&page=3');
    expect(catalogHref('/products', {})).toBe('/products');
    expect(hasActiveFilters({ page: 2 })).toBe(false);
    expect(hasActiveFilters({ availability: 'out_of_stock' })).toBe(true);
  });
});

function fd(entries: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

describe('product validation', () => {
  const base = { name: 'Clutch Plate', slug: '', part_number: '', description: '', category_id: '', availability: 'available', status: 'draft', part_type: 'oem' };
  it('accepts a minimal product and generates the slug', () => {
    const r = productFromForm(fd(base));
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.slug).toBe('clutch-plate');
      expect(r.data.part_number).toBeNull();
      expect(r.data.category_id).toBeNull();
      expect(r.data.is_featured).toBe(false);
      expect(r.data.model_ids).toEqual([]);
    }
  });
  it('collects multiple models and the featured checkbox', () => {
    const ids = ['2b7c7f3e-0b1a-4b3c-9d2e-1f2a3b4c5d6e', '3c8d8f4f-1c2b-4c4d-8e3f-2a3b4c5d6e7f'];
    const r = productFromForm(fd({ ...base, model_ids: ids, is_featured: 'on' }));
    expect(r.success && r.data.model_ids).toEqual(ids);
    expect(r.success && r.data.is_featured).toBe(true);
  });
  it('rejects bad input', () => {
    expect(productFromForm(fd({ ...base, name: 'a' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, slug: 'Bad Slug' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, availability: 'maybe' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, status: 'live' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, category_id: 'not-a-uuid' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, model_ids: ['x'] })).success).toBe(false);
    expect(productFromForm(fd({ ...base, seo_title: 'x'.repeat(71) })).success).toBe(false);
    // Every part must say whether it is genuine or vendor.
    expect(productFromForm(fd({ ...base, part_type: 'cheap' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, part_type: '' })).success).toBe(false);
    expect(productFromForm(fd({ ...base, part_type: 'vendor' })).success).toBe(true);
  });
});

describe('settings validation', () => {
  const base = { business_name: 'S Ameer Ali Bullet Spare Parts', landline: '044 2841 5241' };
  it('normalises a valid WhatsApp number and blanks to null', () => {
    const r = settingsFromForm(fd({ ...base, whatsapp_number: '+91 98765 43210', opening_hours: '  ' }));
    expect(r.success && r.data.whatsapp_number).toBe('919876543210');
    expect(r.success && r.data.opening_hours).toBeNull();
  });
  it('accepts the shop number for both the landline and WhatsApp', () => {
    const r = settingsFromForm(fd({ business_name: 'S Ameer Ali Bullet Spare Parts', landline: '+91 96770 93315', whatsapp_number: '+91 96770 93315' }));
    expect(r.success && r.data.whatsapp_number).toBe('919677093315');
  });
  it('rejects invalid numbers and non-https links', () => {
    expect(settingsFromForm(fd({ ...base, whatsapp_number: '12' })).success).toBe(false);
    expect(settingsFromForm(fd({ ...base, google_maps_url: 'http://maps.example.com' })).success).toBe(false);
    expect(settingsFromForm(fd({ ...base, facebook_url: 'javascript:alert(1)' })).success).toBe(false);
    expect(settingsFromForm(fd({ ...base, email: 'nope' })).success).toBe(false);
  });
});

describe('taxonomy validation', () => {
  it('generates slugs and reads the active checkbox', () => {
    const r = taxonomyFromForm(fd({ name: 'Interceptor 650', slug: '' }));
    expect(r.success && r.data.slug).toBe('interceptor-650');
    expect(r.success && r.data.is_active).toBe(false);
    expect(taxonomyFromForm(fd({ name: '', slug: '' })).success).toBe(false);
  });
});

describe('image rules', () => {
  const id = '2b7c7f3e-0b1a-4b3c-9d2e-1f2a3b4c5d6e';
  it('only accepts paths inside the product folder', () => {
    expect(isValidImagePath(id, `products/${id}/0f8fad5b-d9cb-469f-a165-70867728950e.webp`)).toBe(true);
    expect(isValidImagePath(id, `products/${id}/../x.webp`)).toBe(false);
    expect(isValidImagePath(id, `products/3c8d8f4f-1c2b-4c4d-8e3f-2a3b4c5d6e7f/0f8fad5b-d9cb.webp`)).toBe(false);
    expect(isValidImagePath(id, `products/${id}/0f8fad5b-d9cb-469f.gif`)).toBe(false);
    expect(isValidImagePath('nope', 'products/nope/abcdefgh.webp')).toBe(false);
  });
  it('resizes to fit 1600px without upscaling', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe('admin redirects', () => {
  it('only allows redirects inside /admin', () => {
    expect(safeAdminPath('/admin/products')).toBe('/admin/products');
    expect(safeAdminPath('https://evil.example')).toBe('/admin');
    expect(safeAdminPath('//evil.example')).toBe('/admin');
    expect(safeAdminPath('/admin\\..\\x')).toBe('/admin');
    expect(safeAdminPath(undefined)).toBe('/admin');
  });
});

describe('part sharing', () => {
  it('builds a share message with the part number and link', () => {
    const msg = buildPartShareMessage({
      productName: 'Clutch Plate Set',
      partNumber: '2110-1234',
      url: 'https://ameeralibulletspares.in/products/clutch-plate-set',
    });
    expect(msg).toBe(
      'Genuine Royal Enfield part: Clutch Plate Set (part no. 2110-1234). https://ameeralibulletspares.in/products/clutch-plate-set',
    );
  });

  it('omits the part number when there is none', () => {
    const msg = buildPartShareMessage({ productName: 'Rear Tyre', partNumber: null, url: 'https://example.com/p' });
    expect(msg).toBe('Genuine Royal Enfield part: Rear Tyre. https://example.com/p');
  });

  it('builds a WhatsApp chooser link with the message encoded', () => {
    expect(buildWhatsAppShareUrl('Hi & bye')).toBe('https://wa.me/?text=Hi%20%26%20bye');
  });
});
