import type { BusinessSettings } from './types';

/** Public origin of the site, no trailing slash. Set NEXT_PUBLIC_SITE_URL in production. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/+$/, '');

/**
 * CONFIRMED business facts supplied by the client (source of truth in the
 * project brief). Used only as a fallback if the database is unreachable or
 * not yet configured. Anything not confirmed is null and therefore hidden.
 */
/** The shop's phone number, used for both calls and WhatsApp. */
export const SHOP_PHONE = '+91 96770 93315';

export const CONFIRMED_BUSINESS: BusinessSettings = {
  business_name: 'S Ameer Ali Bullet Spare Parts',
  address: '25, Venkatachalan Naicken Street, Pudupet, Chennai-02',
  landline: SHOP_PHONE,
  whatsapp_number: '919677093315',
  email: null,
  opening_hours: null,
  google_maps_url: null,
  facebook_url: null,
  instagram_url: null,
  youtube_url: null,
  about_intro: null,
  about_history: null,
  hero_image_path: null,
  festive_active: false,
  festive_label: null,
  festive_discount_type: 'percent',
  festive_discount_value: 0,
  default_image_provider: 'supabase',
};

/** Short brand name used in headings and titles. */
export const BRAND_SHORT = 'S Ameer Ali';

/** Postal address parts for structured data (derived from the confirmed address). */
export const POSTAL_ADDRESS = {
  streetAddress: '25, Venkatachalan Naicken Street, Pudupet',
  addressLocality: 'Chennai',
  addressRegion: 'Tamil Nadu',
  postalCode: '600002',
  addressCountry: 'IN',
} as const;

export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
