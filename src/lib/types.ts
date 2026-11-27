import type { ImageProvider } from './image-providers';
import type { PartType } from './part-types';
import type { SupplyPrices } from './pricing';
import type { PriceView } from './pricing';

export type Availability = 'available' | 'out_of_stock' | 'contact_to_confirm';
export type ProductStatus = 'draft' | 'published' | 'hidden' | 'archived';

export const AVAILABILITY_OPTIONS: { value: Availability; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'out_of_stock', label: 'Out of Stock' },
  { value: 'contact_to_confirm', label: 'Contact to Confirm' },
];

export const STATUS_OPTIONS: { value: ProductStatus; label: string; hint: string }[] = [
  { value: 'draft', label: 'Draft', hint: 'Not on the website yet' },
  { value: 'published', label: 'Published', hint: 'Visible to customers' },
  { value: 'hidden', label: 'Hidden', hint: 'Temporarily removed from the website' },
  { value: 'archived', label: 'Archived', hint: 'Retired — kept for records' },
];

export function availabilityLabel(a: Availability): string {
  return AVAILABILITY_OPTIONS.find((o) => o.value === a)?.label ?? 'Contact to Confirm';
}

export function isAvailability(v: unknown): v is Availability {
  return v === 'available' || v === 'out_of_stock' || v === 'contact_to_confirm';
}

export type MotorcycleModel = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  /** Uploaded photo in the brand-images bucket. Null = use the drawing. */
  image_path: string | null;
};

export type ProductCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type BusinessSettings = {
  business_name: string;
  address: string | null;
  landline: string | null;
  whatsapp_number: string | null;
  email: string | null;
  opening_hours: string | null;
  google_maps_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  youtube_url: string | null;
  about_intro: string | null;
  about_history: string | null;
  hero_image_path: string | null;
  festive_active: boolean;
  festive_label: string | null;
  festive_discount_type: 'percent' | 'amount';
  festive_discount_value: number;
  /** Provider used for new product photo uploads unless the admin overrides it. */
  default_image_provider: ImageProvider;
};

export type ProductImage = {
  id: string;
  storage_path: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  sort_order: number;
  is_primary: boolean;
  /** Where the file physically lives. Older rows are 'supabase'. */
  storage_provider: ImageProvider;
  /** ImageKit delivery URL. Null for Supabase images (built from the path). */
  image_url: string | null;
};

/** Row shape returned by the catalog_search() database function. */
export type CatalogItem = {
  id: string;
  name: string;
  slug: string;
  part_number: string | null;
  availability: Availability;
  is_featured: boolean;
  mrp: number | null;
  offer_price: number | null;
  /** Price the customer sees (after any offer), computed on the server. */
  pricing: PriceView;
  category_name: string | null;
  category_slug: string | null;
  image_path: string | null;
  image_alt: string | null;
  image_width: number | null;
  image_height: number | null;
  image_provider: ImageProvider;
  image_url: string | null;
  part_type: PartType;
  vendor_mrp: number | null;
  vendor_offer_price: number | null;
  /** One price view per supply the shop holds this part from. */
  supplyPricing: SupplyPrices;
  total_count: number;
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  part_number: string | null;
  description: string | null;
  availability: Availability;
  is_featured: boolean;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
  mrp: number | null;
  offer_price: number | null;
  pricing: PriceView;
  part_type: PartType;
  vendor_mrp: number | null;
  vendor_offer_price: number | null;
  supplyPricing: SupplyPrices;
  category: Pick<ProductCategory, 'id' | 'name' | 'slug'> | null;
  images: ProductImage[];
  models: Pick<MotorcycleModel, 'id' | 'name' | 'slug'>[];
};
