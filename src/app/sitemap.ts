import type { MetadataRoute } from 'next';
import { getModelsWithCounts, getPublishedProductIndex } from '@/lib/data/catalog';
import { absoluteUrl } from '@/lib/site';

/**
 * Only real, indexable URLs: static pages, model pages that have published
 * parts, and published product pages. Filtered/query URLs are excluded.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [models, products] = await Promise.all([getModelsWithCounts(), getPublishedProductIndex()]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: absoluteUrl('/'), changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/models'), changeFrequency: 'weekly', priority: 0.9 },
    { url: absoluteUrl('/products'), changeFrequency: 'daily', priority: 0.9 },
    { url: absoluteUrl('/contact'), changeFrequency: 'monthly', priority: 0.7 },
    { url: absoluteUrl('/about'), changeFrequency: 'monthly', priority: 0.5 },
  ];

  const modelPages: MetadataRoute.Sitemap = models
    .filter((m) => m.productCount > 0)
    .map((m) => ({ url: absoluteUrl(`/models/${m.slug}`), changeFrequency: 'weekly', priority: 0.8 }));

  const productPages: MetadataRoute.Sitemap = products.map((p) => ({
    url: absoluteUrl(`/products/${p.slug}`),
    lastModified: new Date(p.updated_at),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticPages, ...modelPages, ...productPages];
}
