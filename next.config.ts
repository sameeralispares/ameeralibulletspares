import type { NextConfig } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const isLocalSupabase = Boolean(supabaseUrl && ['127.0.0.1', 'localhost'].includes(supabaseUrl.hostname));

/**
 * ImageKit delivery host, taken from the configured endpoint so only that one
 * host is allowed. Falls back to nothing when ImageKit is not configured.
 */
const imagekitEndpoint = (() => {
  const raw = (process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT ?? process.env.IMAGEKIT_URL_ENDPOINT)?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
})();

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Cache Components is off: its postponed-state and setTimeout handling
  // hang on Cloudflare Workers. Catalogue data is cached with unstable_cache
  // in src/lib/data/catalog.ts instead.
  cacheComponents: false,
  poweredByHeader: false,

  experimental: {
    // Server action bodies carry the home page image (max 3 MB) and photos
    // uploaded to ImageKit through the server (max 4 MB).
    serverActions: { bodySizeLimit: '6mb' },
  },

  images: {
    // Photos from Supabase Storage are served through ImageKit when configured
    // (src/lib/imagekit.ts). Without it, URLs pass through unchanged.
    loader: 'custom',
    loaderFile: './src/lib/imagekit-loader.ts',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [64, 96, 128, 200, 256, 320],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port || undefined,
            pathname: '/storage/v1/object/public/product-images/**',
          },
          {
            protocol: supabaseUrl.protocol.replace(':', '') as 'http' | 'https',
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port || undefined,
            pathname: '/storage/v1/object/public/brand-images/**',
          },
          ...(imagekitEndpoint
            ? [
                {
                  protocol: 'https' as const,
                  hostname: imagekitEndpoint.hostname,
                  pathname: `${imagekitEndpoint.pathname.replace(/\/+$/, '')}/**`,
                },
              ]
            : []),
        ]
      : [],
    // Only for the local test stack on 127.0.0.1 — never true in production.
    // Requires an explicit opt-in env flag AND a localhost Supabase URL.
    dangerouslyAllowLocalIP: isLocalSupabase && process.env.ALLOW_LOCAL_SUPABASE_IMAGES === '1',
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/auth/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },

  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
