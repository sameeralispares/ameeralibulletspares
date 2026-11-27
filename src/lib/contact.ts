/**
 * Phone, WhatsApp and map helpers. Pure functions — unit tested.
 */

/**
 * Convert an Indian phone number as written ("044 2841 5241", "+91 44 2841 5241")
 * into an E.164 string ("+914428415241"). Returns null when it can't be parsed.
 */
export function toE164India(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
    return /^[1-9]\d{9,14}$/.test(digits) ? `+${digits}` : null;
  }
  digits = digits.replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0')) digits = digits.slice(1); // trunk prefix
  if (digits.length === 10) return `+91${digits}`;
  return null;
}

export function telHref(raw: string | null | undefined): string | null {
  const e164 = toE164India(raw);
  return e164 ? `tel:${e164}` : null;
}

/**
 * Normalise a WhatsApp number to the digits-only international format that
 * wa.me requires (e.g. "919876543210"). Accepts spaces, dashes, "+" and a
 * leading 0. Returns null for anything that isn't a plausible number.
 */
export function normaliseWhatsAppNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let digits = trimmed.replace(/\D/g, '');
  if (!trimmed.startsWith('+') && digits.length === 11 && digits.startsWith('0')) {
    digits = `91${digits.slice(1)}`; // 0 98765 43210 -> 91 98765 43210
  } else if (!trimmed.startsWith('+') && digits.length === 10) {
    digits = `91${digits}`; // bare Indian mobile number
  }
  return /^[1-9]\d{9,14}$/.test(digits) ? digits : null;
}

export type EnquiryContext = {
  productName?: string | null;
  modelName?: string | null;
  partNumber?: string | null;
};

export function buildEnquiryMessage(ctx: EnquiryContext = {}): string {
  const product = ctx.productName?.trim();
  const model = ctx.modelName?.trim();
  const part = ctx.partNumber?.trim();
  if (product) {
    const forModel = model ? ` for ${model}` : '';
    const partText = part ? ` (part no. ${part})` : '';
    return `Hello, I am enquiring about ${product}${partText}${forModel}. Is this genuine part currently available?`;
  }
  if (model) {
    return `Hello, I am looking for genuine Royal Enfield spare parts for my ${model}. Can you help?`;
  }
  return 'Hello, I would like to enquire about genuine Royal Enfield spare parts.';
}

/**
 * Build a wa.me deep link. Returns null (never a broken link) when the number
 * is missing or invalid.
 */
export function buildWhatsAppUrl(number: string | null | undefined, message: string): string | null {
  const n = normaliseWhatsAppNumber(number);
  if (!n) return null;
  return `https://wa.me/${n}?text=${encodeURIComponent(message)}`;
}

/**
 * Google Maps link. Uses the owner-verified Maps URL when configured;
 * otherwise Google's documented search URL with the confirmed address text.
 * Never invents coordinates or place IDs.
 */
export function mapsUrl(opts: { verifiedUrl?: string | null; name: string; address?: string | null }): string | null {
  const verified = opts.verifiedUrl?.trim();
  if (verified && /^https:\/\//.test(verified)) return verified;
  if (!opts.address) return null;
  const query = `${opts.name}, ${opts.address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Message a customer sends when they share a part with someone (e.g. a
 * riding buddy or mechanic). Includes the part number and the public link.
 */
export function buildPartShareMessage(opts: { productName: string; partNumber?: string | null; url: string }): string {
  const part = opts.partNumber?.trim();
  const partText = part ? ` (part no. ${part})` : '';
  return `Genuine Royal Enfield part: ${opts.productName.trim()}${partText}. ${opts.url}`;
}

/**
 * WhatsApp "pick a contact" link (no fixed recipient) for sharing text.
 */
export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Message for customers whose part is not listed on the website yet. */
export const NOT_LISTED_MESSAGE =
  'Hello, I am looking for a genuine Royal Enfield spare part that is not listed on your website. Can you check availability? My motorcycle model is: ';
