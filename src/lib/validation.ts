import { z } from 'zod';
import { SLUG_PATTERN, slugify } from './slug';
import { normaliseWhatsAppNumber } from './contact';

/** Rupee amount from a form field: "" -> null, "1,250" -> 1250, text -> NaN (rejected by zod). */
export function rupeesFromForm(raw: FormDataEntryValue | null): number | null {
  const text = String(raw ?? '').trim().replace(/[₹,\s]/g, '');
  if (text === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(text) ? Number(text) : Number.NaN;
}

const rupeesField = z
  .number({ message: 'Enter the price in rupees, e.g. 1250' })
  .positive('The price must be more than ₹0')
  .max(9999999, 'The price is too large')
  .nullable();

/** Empty strings from forms become null; text is trimmed. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const optionalHttpsUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === '' ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null)
  .refine((v) => v === null || /^https:\/\/[^\s]+\.[^\s]+/.test(v), 'Enter a full link starting with https://');

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .max(120, 'Keep the URL name under 120 characters')
  .refine((v) => v === '' || SLUG_PATTERN.test(v), 'Use lowercase letters, numbers and single hyphens only');

const uuid = z.string().uuid();

export const productSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(2, 'Enter the part name').max(140, 'Keep the name under 140 characters'),
    slug: slugField,
    part_number: optionalText(60),
    description: optionalText(5000),
    category_id: z
      .string()
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .refine((v) => v === null || uuid.safeParse(v).success, 'Choose a valid category'),
    availability: z.enum(['available', 'out_of_stock', 'contact_to_confirm'], { message: 'Choose the availability' }),
    status: z.enum(['draft', 'published', 'hidden', 'archived'], { message: 'Choose a status' }),
    is_featured: z.boolean(),
    part_type: z.enum(['oem', 'vendor', 'both'], { message: 'Choose OEM, vendor or both' }),
    model_ids: z.array(uuid).max(100),
    seo_title: optionalText(70),
    seo_description: optionalText(170),
    mrp: rupeesField,
    offer_price: rupeesField,
    vendor_mrp: rupeesField,
    vendor_offer_price: rupeesField,
  })
  .superRefine((v, ctx) => {
    if (v.offer_price !== null && v.mrp === null) {
      ctx.addIssue({ code: 'custom', path: ['mrp'], message: 'Enter the MRP before adding an offer price' });
    }
    if (v.offer_price !== null && v.mrp !== null && v.offer_price > v.mrp) {
      ctx.addIssue({ code: 'custom', path: ['offer_price'], message: 'The offer price cannot be more than the MRP' });
    }
    // A vendor price only means something on a part held from both supplies.
    if (v.part_type !== 'both' && (v.vendor_mrp !== null || v.vendor_offer_price !== null)) {
      ctx.addIssue({ code: 'custom', path: ['vendor_mrp'], message: 'Choose “Both” to set a separate vendor price' });
    }
    if (v.vendor_offer_price !== null && v.vendor_mrp === null) {
      ctx.addIssue({ code: 'custom', path: ['vendor_mrp'], message: 'Enter the vendor MRP before adding a vendor offer price' });
    }
    if (v.vendor_offer_price !== null && v.vendor_mrp !== null && v.vendor_offer_price > v.vendor_mrp) {
      ctx.addIssue({ code: 'custom', path: ['vendor_offer_price'], message: 'The offer price cannot be more than the vendor MRP' });
    }
  })
  .transform((v) => ({ ...v, slug: v.slug || slugify(v.name) }))
  .refine((v) => v.slug.length > 0, { message: 'Enter a URL name', path: ['slug'] });

export type ProductInput = z.infer<typeof productSchema>;

export function productFromForm(fd: FormData) {
  return productSchema.safeParse({
    id: (fd.get('id') as string) || undefined,
    name: fd.get('name') ?? '',
    slug: fd.get('slug') ?? '',
    part_number: fd.get('part_number') ?? '',
    description: fd.get('description') ?? '',
    category_id: fd.get('category_id') ?? '',
    availability: fd.get('availability'),
    status: fd.get('status'),
    is_featured: fd.get('is_featured') === 'on',
    part_type: fd.get('part_type'),
    model_ids: fd.getAll('model_ids').map(String),
    seo_title: fd.get('seo_title') ?? '',
    seo_description: fd.get('seo_description') ?? '',
    mrp: rupeesFromForm(fd.get('mrp')),
    offer_price: rupeesFromForm(fd.get('offer_price')),
    vendor_mrp: rupeesFromForm(fd.get('vendor_mrp')),
    vendor_offer_price: rupeesFromForm(fd.get('vendor_offer_price')),
  });
}

export const taxonomySchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1, 'Enter a name').max(80, 'Keep the name under 80 characters'),
    slug: slugField,
    description: optionalText(600),
    is_active: z.boolean(),
  })
  .transform((v) => ({ ...v, slug: v.slug || slugify(v.name) }))
  .refine((v) => v.slug.length > 0, { message: 'Enter a URL name', path: ['slug'] });

export function taxonomyFromForm(fd: FormData) {
  return taxonomySchema.safeParse({
    id: (fd.get('id') as string) || undefined,
    name: fd.get('name') ?? '',
    slug: fd.get('slug') ?? '',
    description: fd.get('description') ?? '',
    is_active: fd.get('is_active') === 'on',
  });
}

export const settingsSchema = z
  .object({
    business_name: z.string().trim().min(2, 'Enter the business name').max(120),
    address: optionalText(300),
    landline: optionalText(20).refine((v) => v === null || /^[0-9 +()-]{6,20}$/.test(v), 'Enter a valid phone number'),
    whatsapp_number: z
      .string()
      .trim()
      .max(25)
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional()
      .transform((v) => v ?? null),
    email: optionalText(200).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Enter a valid email address'),
    opening_hours: optionalText(500),
    google_maps_url: optionalHttpsUrl,
    facebook_url: optionalHttpsUrl,
    instagram_url: optionalHttpsUrl,
    youtube_url: optionalHttpsUrl,
    about_intro: optionalText(2000),
    about_history: optionalText(5000),
    festive_active: z.boolean(),
    festive_label: optionalText(80),
    festive_discount_type: z.enum(['percent', 'amount'], { message: 'Choose percent or rupees' }),
    festive_discount_value: z
      .number({ message: 'Enter a number, e.g. 10 or 200' })
      .min(0, 'The discount cannot be negative')
      .max(999999, 'The discount is too large'),
  })
  .superRefine((v, ctx) => {
    if (v.whatsapp_number !== null && !normaliseWhatsAppNumber(v.whatsapp_number)) {
      ctx.addIssue({
        code: 'custom',
        path: ['whatsapp_number'],
        message: 'Enter the WhatsApp mobile number with country code, e.g. +91 98765 43210',
      });
    }
    if (v.festive_discount_type === 'percent' && v.festive_discount_value > 90) {
      ctx.addIssue({ code: 'custom', path: ['festive_discount_value'], message: 'A percentage discount must be 90 or less' });
    }
    if (v.festive_active && v.festive_discount_value <= 0) {
      ctx.addIssue({ code: 'custom', path: ['festive_discount_value'], message: 'Enter the discount to switch the festive offer on' });
    }
  })
  .transform((v) => ({ ...v, whatsapp_number: v.whatsapp_number ? normaliseWhatsAppNumber(v.whatsapp_number) : null }));

export function settingsFromForm(fd: FormData) {
  const keys = [
    'business_name', 'address', 'landline', 'whatsapp_number', 'email', 'opening_hours', 'google_maps_url',
    'facebook_url', 'instagram_url', 'youtube_url', 'about_intro', 'about_history', 'festive_label',
  ] as const;
  const raw: Record<string, unknown> = {};
  for (const k of keys) raw[k] = String(fd.get(k) ?? '');
  raw.festive_active = fd.get('festive_active') === 'on';
  raw.festive_discount_type = fd.get('festive_discount_type') === 'amount' ? 'amount' : 'percent';
  const discount = String(fd.get('festive_discount_value') ?? '').trim().replace(/,/g, '');
  raw.festive_discount_value = discount === '' ? 0 : Number(discount);
  return settingsSchema.safeParse(raw);
}

/** Flatten zod issues to { field: message } for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Storage paths must live under the product's own folder. */
export function isValidImagePath(productId: string, path: string): boolean {
  if (!uuid.safeParse(productId).success) return false;
  const re = new RegExp(`^products/${productId}/[a-z0-9-]{8,64}\\.(webp|jpg|png)$`);
  return re.test(path);
}

/**
 * Path check for an uploaded file, per provider. ImageKit returns a filePath
 * with a leading slash; everything else about the shape is the same, so a file
 * can never be recorded outside its own product's folder.
 */
export function isValidProviderPath(provider: 'supabase' | 'imagekit', productId: string, path: string): boolean {
  if (!uuid.safeParse(productId).success) return false;
  if (provider === 'supabase') return isValidImagePath(productId, path);
  return new RegExp(`^/?products/${productId}/[a-z0-9-]{8,64}\\.(webp|jpg|png)$`).test(path);
}

export const ALLOWED_UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const;
export const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024; // before in-browser compression
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // after compression (bucket limit)
