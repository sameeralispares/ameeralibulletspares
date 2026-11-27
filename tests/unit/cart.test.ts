import { describe, expect, it } from 'vitest';
import {
  CART_MAX_LINES,
  CART_MAX_QTY,
  addLine,
  buildOrderMessage,
  buildOrderUrl,
  cartCount,
  cartTotal,
  lineKey,
  orderDetailsSchema,
  parseStoredCart,
  removeLine,
  setQty,
  type CartLine,
} from '@/lib/cart';

const line = (id: string, unitPrice: number | null = 800, extra: Partial<CartLine> = {}): Omit<CartLine, 'qty'> => ({
  productId: id,
  slug: `part-${id}`,
  name: `Part ${id}`,
  partNumber: `PN-${id}`,
  unitPrice,
  partType: 'oem',
  ...extra,
});

const details = { name: 'Asif Ismail', mobile: '98765 43210', address: '', motorcycle: 'Classic 350', note: '' };

describe('cart lines', () => {
  it('adds a new line with quantity 1 and merges repeat adds', () => {
    let r = addLine([], line('a'));
    expect(r.lines).toEqual([{ ...line('a'), qty: 1 }]);
    r = addLine(r.lines, line('a'), 2);
    expect(r.lines[0].qty).toBe(3);
    expect(r.lines).toHaveLength(1);
  });

  it('caps quantity per line', () => {
    const r = addLine([], line('a'), 500);
    expect(r.lines[0].qty).toBe(CART_MAX_QTY);
  });

  it('refuses a new line beyond the limit but still merges existing ones', () => {
    let lines: CartLine[] = [];
    for (let i = 0; i < CART_MAX_LINES; i++) lines = addLine(lines, line(`p${i}`)).lines;
    const full = addLine(lines, line('extra'));
    expect(full.error).toBe('full');
    expect(full.lines).toHaveLength(CART_MAX_LINES);
    expect(addLine(lines, line('p0')).error).toBeUndefined();
  });

  it('keys a line by product and supply, so OEM and vendor stock stay separate', () => {
    expect(lineKey({ productId: 'a', partType: 'oem' })).toBe('a:oem');
    expect(lineKey({ productId: 'a', partType: 'vendor' })).toBe('a:vendor');
    let r = addLine([], line('a', 800, { partType: 'oem' }));
    r = addLine(r.lines, line('a', 700, { partType: 'vendor' }));
    expect(r.lines).toHaveLength(2);
    expect(r.lines.map((l) => l.unitPrice)).toEqual([800, 700]);
  });

  it('sets quantity, removes at zero and ignores invalid numbers', () => {
    const key = 'a:oem';
    const lines = addLine([], line('a')).lines;
    expect(setQty(lines, key, 4)[0].qty).toBe(4);
    expect(setQty(lines, key, 0)).toEqual([]);
    expect(setQty(lines, key, Number.NaN)).toEqual([]);
    expect(setQty(lines, key, 2.9)[0].qty).toBe(2);
  });

  it('changes only the line that was asked for', () => {
    const lines = addLine(addLine([], line('a', 800, { partType: 'oem' })).lines, line('a', 700, { partType: 'vendor' })).lines;
    const after = setQty(lines, 'a:vendor', 3);
    expect(after.map((l) => l.qty)).toEqual([1, 3]);
    expect(removeLine(after, 'a:oem').map((l) => l.partType)).toEqual(['vendor']);
  });

  it('removes a line by its key', () => {
    const lines = addLine(addLine([], line('a')).lines, line('b')).lines;
    expect(removeLine(lines, 'a:oem').map((l) => l.productId)).toEqual(['b']);
  });
});

describe('totals', () => {
  it('sums priced lines and counts items on enquiry separately', () => {
    const lines: CartLine[] = [
      { ...line('a', 800), qty: 2 },
      { ...line('b', null), qty: 1 },
      { ...line('c', 99.5), qty: 1 },
    ];
    expect(cartCount(lines)).toBe(4);
    expect(cartTotal(lines)).toEqual({ pricedTotal: 1699.5, allPriced: false, unpricedLines: 1 });
  });

  it('reports allPriced when every line has a price', () => {
    expect(cartTotal([{ ...line('a', 100), qty: 3 }])).toEqual({ pricedTotal: 300, allPriced: true, unpricedLines: 0 });
  });
});

describe('stored cart', () => {
  it('reads a valid saved cart', () => {
    const saved = [{ ...line('a', 800), qty: 2 }];
    expect(parseStoredCart(JSON.stringify(saved))).toEqual(saved);
  });

  it('ignores missing, corrupt or tampered data', () => {
    expect(parseStoredCart(null)).toEqual([]);
    expect(parseStoredCart('not json')).toEqual([]);
    expect(parseStoredCart('{"lines":1}')).toEqual([]);
    expect(parseStoredCart(JSON.stringify([{ productId: 'a', qty: 0 }]))).toEqual([]);
    expect(parseStoredCart(JSON.stringify([{ ...line('a'), qty: 1, unitPrice: -5 }]))).toEqual([]);
  });
});

describe('order details validation', () => {
  it('requires a name and a valid Indian mobile number', () => {
    expect(orderDetailsSchema.safeParse({ name: 'A', mobile: '98765 43210' }).success).toBe(false);
    expect(orderDetailsSchema.safeParse({ name: 'Asif', mobile: '' }).success).toBe(false);
    expect(orderDetailsSchema.safeParse({ name: 'Asif', mobile: '12345' }).success).toBe(false);
    expect(orderDetailsSchema.safeParse({ name: 'Asif', mobile: '98765 43210' }).success).toBe(true);
    expect(orderDetailsSchema.safeParse({ name: 'Asif', mobile: '+91 98765 43210' }).success).toBe(true);
  });

  it('keeps the optional fields optional', () => {
    const ok = orderDetailsSchema.safeParse({ name: 'Asif', mobile: '9876543210', address: '', motorcycle: '', note: '' });
    expect(ok.success).toBe(true);
  });
});

describe('order message', () => {
  const lines: CartLine[] = [
    { ...line('a', 800), qty: 2 },
    { ...line('b', null), qty: 1 },
  ];

  it('lists items, prices, totals and the customer details', () => {
    const msg = buildOrderMessage(lines, details);
    expect(msg).toContain('1. Part a (part no. PN-a) [OEM] × 2 — ₹800 each = ₹1,600');
    expect(msg).toContain('2. Part b (part no. PN-b) [OEM] × 1 — price on enquiry');
    expect(msg).toContain('Priced items total: ₹1,600; 1 item(s) on enquiry');
    expect(msg).toContain('Name: Asif Ismail');
    expect(msg).toContain('Mobile: 98765 43210');
    expect(msg).toContain('Motorcycle: Classic 350');
    expect(msg).not.toContain('Address / delivery');
  });

  it('states the total when every item is priced', () => {
    const msg = buildOrderMessage([{ ...line('a', 800), qty: 2 }], details);
    expect(msg).toContain('Total as shown on the website: ₹1,600');
  });

  it('builds a wa.me link to the shop with the message encoded', () => {
    const url = buildOrderUrl('919677093315', lines, details)!;
    expect(url.startsWith('https://wa.me/919677093315?text=')).toBe(true);
    expect(decodeURIComponent(url.split('text=')[1])).toContain('Asif Ismail');
  });

  it('returns no link when the shop number is missing', () => {
    expect(buildOrderUrl(null, lines, details)).toBeNull();
  });

  it('trims long free text so the link stays a sensible length', () => {
    const msg = buildOrderMessage([{ ...line('a', 1), name: 'x'.repeat(500), qty: 1 }], { ...details, note: 'n'.repeat(1000) });
    expect(msg.length).toBeLessThan(1200);
    expect(msg).toContain('…');
  });
});
