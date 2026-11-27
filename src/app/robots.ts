import type { MetadataRoute } from 'next';
import { absoluteUrl, SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  // Non-production deployments (e.g. Vercel previews) must never be indexed.
  const isProduction = process.env.SITE_ENV ? process.env.SITE_ENV === 'production' : process.env.VERCEL_ENV !== 'preview';
  if (!isProduction) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/auth/'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
