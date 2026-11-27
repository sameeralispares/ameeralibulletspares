/**
 * Cart and WhatsApp order logic. Pure functions, unit tested.
 *
 * The cart lives in the visitor's browser (localStorage); nothing is stored on
 * the server. An order is sent as a pre-filled WhatsApp message that the
 * visitor reviews and sends themselves. The shop confirms stock and the final
 * price on WhatsApp.
 */
import { z } from 'zod';
import { buildWhatsAppUrl, normaliseWhatsAppNumber } from './contact';
import { SUPPLY_LABEL, isSupply, type Supply } from './part-types';
import { formatINR } from './pricing';

export const CART_MAX_LINES = 20;
export const CART_MAX_QTY = 99;

export type CartLine = {
  productId: string;
  slug: string;
  name: string;
  partNumber: string | null;
  /** Price in rupees as shown on the website when added; null = price on enquiry. */
  unitPrice: number | null;
  /** Which supply the stock came from, so the shop picks the right one. */
  partType: Supply;
  qty: number;
};

export type AddResult = { lines: CartLine[]; error?: 'full' };

/**
 * A line is one part from one supply. The OEM and the vendor version of the
 * same part are different stock at different prices, so they are separate
 * lines rather than one merged line.
 */
export function lineKey(line: { productId: string; partType: Supply }): string {
  return `${line.productId}:${line.partType}`;
}

/** Adds one unit (or merges into an existing line). Refuses a new line beyond the limit. */
export function addLine(lines: CartLine[], line: Omit<CartLine, 'qty'>, qty = 1): AddResult {
  const key = lineKey(line);
  const existing = lines.find((l) => lineKey(l) === key);
  if (existing) {
    return { lines: lines.map((l) => (lineKey(l) === key ? { ...l, qty: clampQty(l.qty + qty) } : l)) };
  }
  if (lines.length >= CART_MAX_LINES) return { lines, error: 'full' };
  return { lines: [...lines, { ...line, unitPrice: line.unitPrice ?? null, qty: clampQty(qty) }] };
}

export function setQty(lines: CartLine[], key: string, qty: number): CartLine[] {
  if (!Number.isFinite(qty) || qty <= 0) return removeLine(lines, key);
  return lines.map((l) => (lineKey(l) === key ? { ...l, qty: clampQty(Math.floor(qty)) } : l));
}

export function removeLine(lines: CartLine[], key: string): CartLine[] {
  return lines.filter((l) => lineKey(l) !== key);
}

export function clampQty(qty: number): number {
  return Math.min(CART_MAX_QTY, Math.max(1, Math.floor(qty)));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0);
}

export type CartTotal = {
  /** Sum of priced lines, in rupees. */
  pricedTotal: number;
  /** True when every line has a price. */
  allPriced: boolean;
  /** Number of lines with price on enquiry. */
  unpricedLines: number;
};

export function cartTotal(lines: CartLine[]): CartTotal {
  let pricedTotal = 0;
  let unpricedLines = 0;
  for (const l of lines) {
    if (l.unitPrice === null) unpricedLines += 1;
    else pricedTotal += l.unitPrice * l.qty;
  }
  return { pricedTotal: Math.round(pricedTotal * 100) / 100, allPriced: unpricedLines === 0, unpricedLines };
}

const storedLineSchema = z.object({
  productId: z.string().min(1).max(64),
  slug: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  partNumber: z.string().max(60).nullable(),
  unitPrice: z.number().nonnegative().max(10_000_000).nullable(),
  // Carts saved before this column existed are read as OEM stock.
  partType: z.string().transform((v) => (isSupply(v) ? v : 'oem')).default('oem'),
  qty: z.number().int().min(1).max(CART_MAX_QTY),
});
const storedCartSchema = z.array(storedLineSchema).max(CART_MAX_LINES);

/** Reads a cart from localStorage content. Anything malformed is ignored. */
export function parseStoredCart(raw: string | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = storedCartSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export const CART_STORAGE_KEY = 'sap-cart-v1';

export const orderDetailsSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name.').max(80, 'Keep your name under 80 characters.'),
  mobile: z
    .string()
    .trim()
    .min(1, 'Enter your mobile number so the shop can reply.')
    .refine((v) => normaliseWhatsAppNumber(v) !== null, 'Enter a valid mobile number, for example 98765 43210.'),
  address: z.string().trim().max(300, 'Keep the address under 300 characters.').optional().or(z.literal('')),
  motorcycle: z.string().trim().max(80, 'Keep this under 80 characters.').optional().or(z.literal('')),
  note: z.string().trim().max(400, 'Keep the note under 400 characters.').optional().or(z.literal('')),
});

export type OrderDetails = z.infer<typeof orderDetailsSchema>;

/** Plain text sent to the shop. Lines are capped and text is trimmed to keep the link a sensible length. */
export function buildOrderMessage(lines: CartLine[], details: OrderDetails): string {
  const totals = cartTotal(lines);
  const itemLines = lines.map((l, i) => {
    const part = l.partNumber ? ` (part no. ${l.partNumber})` : '';
    const kind = ` [${SUPPLY_LABEL[l.partType]}]`;
    const price =
      l.unitPrice === null
        ? 'price on enquiry'
        : `${formatINR(l.unitPrice)} each = ${formatINR(l.unitPrice * l.qty)}`;
    return `${i + 1}. ${clip(l.name, 120)}${part}${kind} × ${l.qty} — ${price}`;
  });

  const totalLine = totals.allPriced
    ? `Total as shown on the website: ${formatINR(totals.pricedTotal)}`
    : `Priced items total: ${formatINR(totals.pricedTotal)}; ${totals.unpricedLines} item(s) on enquiry`;

  const detailLines = [
    `Name: ${clip(details.name, 80)}`,
    `Mobile: ${details.mobile.trim()}`,
    details.address ? `Address / delivery: ${clip(details.address, 300)}` : null,
    details.motorcycle ? `Motorcycle: ${clip(details.motorcycle, 80)}` : null,
    details.note ? `Note: ${clip(details.note, 400)}` : null,
  ].filter((x): x is string => x !== null);

  return [
    'Hello, I would like to place an order from the S Ameer Ali Bullet Spare Parts website.',
    '',
    'Order:',
    ...itemLines,
    '',
    totalLine,
    'Please confirm availability and the final price.',
    '',
    'My details:',
    ...detailLines,
  ].join('\n');
}

export function buildOrderUrl(whatsappNumber: string | null | undefined, lines: CartLine[], details: OrderDetails): string | null {
  return buildWhatsAppUrl(whatsappNumber, buildOrderMessage(lines, details));
}

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
