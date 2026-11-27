import type { Metadata } from 'next';
import { absoluteUrl, POSTAL_ADDRESS, SITE_URL } from './site';
import { toE164India } from './contact';
import { resolveImageSrc } from './image-source';
import type { BusinessSettings, ProductDetail } from './types';

/** Shared metadata for a public page: title, description, canonical, OG. */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  images?: string[];
  absoluteTitle?: boolean;
}): Metadata {
  const url = absoluteUrl(opts.path);
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.noindex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: opts.title,
      description: opts.description,
      url,
      type: 'website',
      locale: 'en_IN',
      siteName: 'S Ameer Ali Bullet Spare Parts',
      images: opts.images?.length ? opts.images.map((u) => ({ url: u })) : undefined,
    },
  };
}

/**
 * LocalBusiness (AutoPartsStore) JSON-LD built ONLY from confirmed settings.
 * No coordinates, ratings, reviews, price range or hours are invented; hours
 * are free text in the admin, so they're shown on the page but not encoded.
 */
export function localBusinessJsonLd(s: BusinessSettings) {
  const sameAs = [s.facebook_url, s.instagram_url, s.youtube_url].filter(Boolean);
  const telephone = toE164India(s.landline);
  return {
    '@context': 'https://schema.org',
    '@type': 'AutoPartsStore',
    '@id': `${SITE_URL}/#business`,
    name: s.business_name,
    url: SITE_URL,
    image: absoluteUrl('/opengraph-image'),
    logo: absoluteUrl('/brand/sameerali-badge.png'),
    ...(telephone ? { telephone } : {}),
    ...(s.email ? { email: s.email } : {}),
    ...(s.address ? { address: { '@type': 'PostalAddress', ...POSTAL_ADDRESS } } : {}),
    ...(s.google_maps_url ? { hasMap: s.google_maps_url } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    areaServed: { '@type': 'City', name: 'Chennai' },
  };
}

/**
 * Product JSON-LD with genuine data only. No `offers` block: the shop does not
 * publish prices, and schema.org Offer without a price would be misleading.
 */
export function productJsonLd(p: ProductDetail, s: BusinessSettings) {
  const images = p.images.map((i) => resolveImageSrc(i)).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    url: absoluteUrl(`/products/${p.slug}`),
    ...(p.description ? { description: p.description.slice(0, 5000) } : {}),
    ...(images.length ? { image: images } : {}),
    ...(p.part_number ? { sku: p.part_number, mpn: p.part_number } : {}),
    ...(p.category ? { category: p.category.name } : {}),
    brand: { '@type': 'Brand', name: 'Royal Enfield' },
    ...(p.models.length
      ? { isAccessoryOrSparePartFor: p.models.map((m) => ({ '@type': 'Product', name: `Royal Enfield ${m.name}` })) }
      : {}),
    seller: { '@id': `${SITE_URL}/#business`, '@type': 'AutoPartsStore', name: s.business_name },
  };
}
