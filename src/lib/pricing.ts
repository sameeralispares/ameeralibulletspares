/**
 * Prices are in Indian rupees (INR). Pure functions, unit tested.
 *
 *  - MRP is the printed price of a part.
 *  - An offer price, when set on a part, is the price customers pay.
 *  - During a festive offer (set once for the whole shop), every part with an
 *    MRP is discounted by a percentage or a fixed amount, unless the part has
 *    its own offer price, which always wins.
 */

import type { PartType, Supply } from './part-types';

export type FestiveOffer = {
  label: string | null;
  type: 'percent' | 'amount';
  value: number;
};

export type PriceView = {
  /** Price the customer pays, or null when no MRP is set (price on enquiry). */
  price: number | null;
  /** The MRP to show struck through, only when the price is lower. */
  original: number | null;
  /** Whole-number percentage saved, only when the price is lower. */
  savePercent: number | null;
  onOffer: boolean;
};

const NO_PRICE: PriceView = { price: null, original: null, savePercent: null, onOffer: false };

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Returns the festive offer only when it is switched on and has a real value. */
export function activeFestiveOffer(settings: {
  festive_active: boolean;
  festive_label: string | null;
  festive_discount_type: 'percent' | 'amount';
  festive_discount_value: number;
}): FestiveOffer | null {
  if (!settings.festive_active || !(settings.festive_discount_value > 0)) return null;
  return {
    label: settings.festive_label,
    type: settings.festive_discount_type,
    value: settings.festive_discount_value,
  };
}

export function priceFor(
  part: { mrp: number | null; offer_price: number | null },
  festive: FestiveOffer | null,
): PriceView {
  const mrp = part.mrp;
  if (mrp === null || !(mrp > 0)) return NO_PRICE;

  let price = mrp;
  let onOffer = false;

  if (part.offer_price !== null && part.offer_price > 0 && part.offer_price < mrp) {
    price = part.offer_price;
    onOffer = true;
  } else if (festive) {
    const discounted = festive.type === 'percent' ? mrp * (1 - festive.value / 100) : mrp - festive.value;
    const rounded = Math.round(discounted * 100) / 100;
    if (rounded > 0 && rounded < mrp) {
      price = rounded;
      onOffer = true;
    }
  }

  return {
    price,
    original: onOffer ? mrp : null,
    savePercent: onOffer ? Math.round(((mrp - price) / mrp) * 100) : null,
    onOffer,
  };
}

export type SupplyPrices = {
  /** Price when bought as OEM stock, or null when the shop does not hold it. */
  oem: PriceView | null;
  /** Price when bought as vendor stock, or null. */
  vendor: PriceView | null;
};

/**
 * Prices per supply. A part held from both supplies keeps its OEM price in
 * mrp / offer_price and its vendor price in vendor_mrp / vendor_offer_price;
 * a single-supply part keeps its one price in mrp / offer_price whichever
 * supply it is.
 */
export function supplyPrices(
  part: {
    part_type: PartType;
    mrp: number | null;
    offer_price: number | null;
    vendor_mrp?: number | null;
    vendor_offer_price?: number | null;
  },
  festive: FestiveOffer | null,
): SupplyPrices {
  const main = priceFor({ mrp: part.mrp, offer_price: part.offer_price }, festive);
  if (part.part_type === 'vendor') return { oem: null, vendor: main };
  if (part.part_type === 'oem') return { oem: main, vendor: null };
  return {
    oem: main,
    vendor: priceFor({ mrp: part.vendor_mrp ?? null, offer_price: part.vendor_offer_price ?? null }, festive),
  };
}

/** The price to show, given which supply the customer is looking at. */
/**
 * Price for the supply the customer picked. An explicit supply that the part
 * does not stock returns no price rather than the other supply's price, so a
 * line can never carry the wrong supply's price. With no choice made yet, the
 * OEM price is shown first, then the vendor price.
 */
export function priceForSupply(prices: SupplyPrices, supply: Supply | undefined): PriceView {
  if (supply === 'vendor') return prices.vendor ?? NO_PRICE;
  if (supply === 'oem') return prices.oem ?? NO_PRICE;
  return prices.oem ?? prices.vendor ?? NO_PRICE;
}

/** Short text for the festive banner, e.g. "10% off MRP" or "₹200 off MRP". */
export function festiveDiscountText(festive: FestiveOffer): string {
  return festive.type === 'percent' ? `${festive.value}% off MRP` : `${formatINR(festive.value)} off MRP`;
}
