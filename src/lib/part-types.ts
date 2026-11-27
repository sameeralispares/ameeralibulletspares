/**
 * Which supply the shop buys a part through.
 *
 * Every part the shop sells is a genuine Royal Enfield part. This is a supply
 * record, not a quality one: OEM stock comes through the OEM supply, vendor
 * stock is the same original part bought in through another vendor, and a part
 * the shop holds from both carries a price for each.
 *
 * Two related types:
 *  - PartType is what a product IS, and can be 'both'.
 *  - Supply is what a customer BUYS, and is always one or the other.
 */
export const PART_TYPES = ['oem', 'vendor', 'both'] as const;

export type PartType = (typeof PART_TYPES)[number];

/** The supplies a customer can actually choose between. */
export const SUPPLIES = ['oem', 'vendor'] as const;

export type Supply = (typeof SUPPLIES)[number];

export const DEFAULT_PART_TYPE: PartType = 'oem';

export function isPartType(value: unknown): value is PartType {
  return typeof value === 'string' && (PART_TYPES as readonly string[]).includes(value);
}

export function isSupply(value: unknown): value is Supply {
  return typeof value === 'string' && (SUPPLIES as readonly string[]).includes(value);
}

/** Validates a product's supply setting, as sent by the admin form. */
export function parsePartType(value: unknown): PartType | null {
  return isPartType(value) ? value : null;
}

/**
 * Validates one supply, as sent in a tab link or stored in a cart. 'both' is
 * refused here: a customer always buys one or the other.
 */
export function parseSupply(value: unknown): Supply | null {
  return isSupply(value) ? value : null;
}

/** Falls back to OEM for rows written before the column existed. */
export function partTypeOf(value: unknown): PartType {
  return isPartType(value) ? value : DEFAULT_PART_TYPE;
}

export function supplyOf(value: unknown): Supply {
  return isSupply(value) ? value : 'oem';
}

/** Which supplies a customer can buy this part from. */
export function suppliesOf(partType: PartType): Supply[] {
  if (partType === 'both') return ['oem', 'vendor'];
  return [partType];
}

export function hasSupply(partType: PartType, supply: Supply): boolean {
  return partType === 'both' || partType === supply;
}

/** Short label for badges and tabs. */
export const PART_TYPE_LABEL: Record<PartType, string> = {
  oem: 'OEM',
  vendor: 'Vendor',
  both: 'OEM & Vendor',
};

export const SUPPLY_LABEL: Record<Supply, string> = {
  oem: 'OEM',
  vendor: 'Vendor',
};

/** Wording for the admin's three choices. */
export const PART_TYPE_LONG_LABEL: Record<PartType, string> = {
  oem: 'OEM only',
  vendor: 'Vendor only',
  both: 'Both',
};

export const PART_TYPE_ADMIN_HINT: Record<PartType, string> = {
  oem: 'Held only as OEM stock.',
  vendor: 'Held only as vendor stock. Still a genuine part.',
  both: 'Held from both supplies. Enter a price for each; the customer chooses.',
};

/** Shown under the tabs on the website. */
export const SUPPLY_BLURB: Record<Supply, string> = {
  oem: 'Genuine Royal Enfield parts held as OEM stock.',
  vendor: 'The same genuine Royal Enfield parts, bought in through one of the shop’s other vendors. Price and availability can differ.',
};
