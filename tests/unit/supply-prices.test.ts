import { describe, expect, it } from 'vitest';
import { priceForSupply, supplyPrices } from '@/lib/pricing';

const base = { mrp: 1000, offer_price: 900, vendor_mrp: 800, vendor_offer_price: 700 };

describe('supply prices', () => {
  it('gives an OEM-only part only an OEM price', () => {
    const p = supplyPrices({ ...base, part_type: 'oem' }, null);
    expect(p.oem?.price).toBe(900);
    expect(p.vendor).toBeNull();
  });

  it('gives a vendor-only part only a vendor price', () => {
    const p = supplyPrices({ part_type: 'vendor', mrp: 1000, offer_price: 900 }, null);
    expect(p.vendor?.price).toBe(900);
    expect(p.oem).toBeNull();
  });

  it('gives a part held from both supplies its own price for each', () => {
    const p = supplyPrices({ ...base, part_type: 'both' }, null);
    expect(p.oem?.price).toBe(900);
    expect(p.vendor?.price).toBe(700);
  });

  it('shows the price for the supply the customer chose', () => {
    const p = supplyPrices({ ...base, part_type: 'both' }, null);
    expect(priceForSupply(p, 'oem').price).toBe(900);
    expect(priceForSupply(p, 'vendor').price).toBe(700);
  });

  it('never gives one supply the other supply price when nothing is chosen yet', () => {
    const oemOnly = supplyPrices({ ...base, part_type: 'oem' }, null);
    expect(priceForSupply(oemOnly, undefined).price).toBe(900);
    const vendorOnly = supplyPrices({ part_type: 'vendor', mrp: 1000, offer_price: 900 }, null);
    expect(priceForSupply(vendorOnly, undefined).price).toBe(900);
  });

  it('returns no price for a supply the part does not stock, rather than the other supply price', () => {
    const oemOnly = supplyPrices({ ...base, part_type: 'oem' }, null);
    expect(priceForSupply(oemOnly, 'vendor').price).toBeNull();
    const vendorOnly = supplyPrices({ part_type: 'vendor', mrp: 1000, offer_price: 900 }, null);
    expect(priceForSupply(vendorOnly, 'oem').price).toBeNull();
  });
});
