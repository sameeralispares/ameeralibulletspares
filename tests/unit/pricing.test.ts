import { describe, expect, it } from 'vitest';
import { activeFestiveOffer, festiveDiscountText, formatINR, priceFor } from '@/lib/pricing';
import { rupeesFromForm, productFromForm } from '@/lib/validation';

const NO_FESTIVE = null;

describe('rupee formatting', () => {
  it('formats in Indian rupees with Indian digit grouping', () => {
    expect(formatINR(1250)).toBe('₹1,250');
    expect(formatINR(125000)).toBe('₹1,25,000');
    expect(formatINR(99.5)).toBe('₹99.5');
  });
});

describe('priceFor', () => {
  it('shows the MRP when there is no offer', () => {
    expect(priceFor({ mrp: 1250, offer_price: null }, NO_FESTIVE)).toEqual({
      price: 1250, original: null, savePercent: null, onOffer: false,
    });
  });

  it('says price on enquiry when no MRP is set', () => {
    expect(priceFor({ mrp: null, offer_price: null }, { label: null, type: 'percent', value: 10 }).price).toBeNull();
  });

  it('uses the part offer price and shows the saving', () => {
    expect(priceFor({ mrp: 1000, offer_price: 800 }, NO_FESTIVE)).toEqual({
      price: 800, original: 1000, savePercent: 20, onOffer: true,
    });
  });

  it('applies a festive percentage discount to the MRP', () => {
    const v = priceFor({ mrp: 1250, offer_price: null }, { label: 'Pongal', type: 'percent', value: 10 });
    expect(v.price).toBe(1125);
    expect(v.original).toBe(1250);
    expect(v.savePercent).toBe(10);
  });

  it('applies a festive rupee discount', () => {
    const v = priceFor({ mrp: 1250, offer_price: null }, { label: null, type: 'amount', value: 200 });
    expect(v.price).toBe(1050);
    expect(v.savePercent).toBe(16);
  });

  it('lets a part offer price win over the festive discount', () => {
    const v = priceFor({ mrp: 1000, offer_price: 900 }, { label: null, type: 'percent', value: 50 });
    expect(v.price).toBe(900);
  });

  it('never goes to zero or below', () => {
    expect(priceFor({ mrp: 150, offer_price: null }, { label: null, type: 'amount', value: 150 }).price).toBe(150);
    expect(priceFor({ mrp: 150, offer_price: null }, { label: null, type: 'amount', value: 999 }).price).toBe(150);
  });
});

describe('festive offer settings', () => {
  const base = { festive_active: true, festive_label: 'Diwali', festive_discount_type: 'percent' as const, festive_discount_value: 10 };
  it('is off unless switched on with a value', () => {
    expect(activeFestiveOffer({ ...base, festive_active: false })).toBeNull();
    expect(activeFestiveOffer({ ...base, festive_discount_value: 0 })).toBeNull();
    expect(activeFestiveOffer(base)).toEqual({ label: 'Diwali', type: 'percent', value: 10 });
  });
  it('describes the discount for the banner', () => {
    expect(festiveDiscountText({ label: null, type: 'percent', value: 10 })).toBe('10% off MRP');
    expect(festiveDiscountText({ label: null, type: 'amount', value: 200 })).toBe('₹200 off MRP');
  });
});

describe('rupee input from forms', () => {
  it('reads plain and comma-separated amounts, blanks as null, text as NaN', () => {
    expect(rupeesFromForm('1250')).toBe(1250);
    expect(rupeesFromForm('1,250.50')).toBe(1250.5);
    expect(rupeesFromForm('₹ 999')).toBe(999);
    expect(rupeesFromForm('')).toBeNull();
    expect(Number.isNaN(rupeesFromForm('abc'))).toBe(true);
  });
});

describe('product price validation', () => {
  const form = (extra: Record<string, string>) => {
    const fd = new FormData();
    const base = { name: 'Clutch plate', slug: '', availability: 'available', status: 'published', part_type: 'oem' };
    for (const [k, v] of Object.entries({ ...base, ...extra })) fd.set(k, v);
    return fd;
  };
  it('accepts an MRP with a lower offer price', () => {
    const r = productFromForm(form({ mrp: '1250', offer_price: '1100' }));
    expect(r.success && r.data.mrp).toBe(1250);
    expect(r.success && r.data.offer_price).toBe(1100);
  });
  it('rejects an offer price above the MRP and an offer without an MRP', () => {
    expect(productFromForm(form({ mrp: '1000', offer_price: '1100' })).success).toBe(false);
    expect(productFromForm(form({ offer_price: '900' })).success).toBe(false);
  });
  it('rejects text and zero prices', () => {
    expect(productFromForm(form({ mrp: 'lots' })).success).toBe(false);
    expect(productFromForm(form({ mrp: '0' })).success).toBe(false);
  });
  it('allows a part with no price at all', () => {
    const r = productFromForm(form({}));
    expect(r.success && r.data.mrp).toBeNull();
  });
});
