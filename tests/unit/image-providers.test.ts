import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_IMAGE_PROVIDER,
  IMAGE_PROVIDERS,
  PROVIDER_LABEL,
  isImageProvider,
  parseImageProvider,
  providerOf,
} from '@/lib/image-providers';
import { resolveCatalogImageSrc, resolveImageSrc } from '@/lib/image-source';
import imageLoader from '@/lib/imagekit-loader';
import { isValidProviderPath } from '@/lib/validation';

const SUPABASE = 'https://abcdefgh.supabase.co';
const PRODUCT = '11111111-2222-4333-8444-555555555555';

describe('provider values', () => {
  it('knows exactly two providers and defaults to Supabase', () => {
    expect([...IMAGE_PROVIDERS]).toEqual(['supabase', 'imagekit']);
    expect(DEFAULT_IMAGE_PROVIDER).toBe('supabase');
    expect(PROVIDER_LABEL.supabase).toBe('Supabase Storage');
    expect(PROVIDER_LABEL.imagekit).toBe('ImageKit');
  });

  it('never trusts an unknown provider sent from a browser', () => {
    expect(parseImageProvider('supabase')).toBe('supabase');
    expect(parseImageProvider('imagekit')).toBe('imagekit');
    for (const junk of ['cloudinary', 'SUPABASE', '', ' imagekit', null, undefined, 1, {}, ['imagekit']]) {
      expect(parseImageProvider(junk)).toBeNull();
    }
  });

  it('treats a missing provider on an older row as Supabase', () => {
    expect(providerOf(undefined)).toBe('supabase');
    expect(providerOf(null)).toBe('supabase');
    expect(providerOf('imagekit')).toBe('imagekit');
    expect(providerOf('nonsense')).toBe('supabase');
    expect(isImageProvider('nonsense')).toBe(false);
  });
});

describe('upload path validation', () => {
  it('keeps a Supabase file inside its own product folder', () => {
    expect(isValidProviderPath('supabase', PRODUCT, `products/${PRODUCT}/abcd1234-aaaa.webp`)).toBe(true);
    expect(isValidProviderPath('supabase', PRODUCT, `products/0000/abcd1234-aaaa.webp`)).toBe(false);
    expect(isValidProviderPath('supabase', PRODUCT, `products/${PRODUCT}/../x.webp`)).toBe(false);
    expect(isValidProviderPath('supabase', PRODUCT, `/products/${PRODUCT}/abcd1234-aaaa.webp`)).toBe(false);
  });

  it('accepts the leading slash ImageKit returns, and nothing outside the folder', () => {
    expect(isValidProviderPath('imagekit', PRODUCT, `/products/${PRODUCT}/abcd1234-aaaa.webp`)).toBe(true);
    expect(isValidProviderPath('imagekit', PRODUCT, `products/${PRODUCT}/abcd1234-aaaa.webp`)).toBe(true);
    expect(isValidProviderPath('imagekit', PRODUCT, `/products/other/abcd1234-aaaa.webp`)).toBe(false);
    expect(isValidProviderPath('imagekit', PRODUCT, `/evil/${PRODUCT}/abcd1234-aaaa.webp`)).toBe(false);
    expect(isValidProviderPath('imagekit', PRODUCT, `/products/${PRODUCT}/script.svg`)).toBe(false);
  });

  it('rejects a bad product id outright', () => {
    expect(isValidProviderPath('imagekit', 'not-a-uuid', '/products/not-a-uuid/abcd1234-aaaa.webp')).toBe(false);
  });
});

describe('provider-independent image resolution', () => {
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-tests';
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it('builds the Supabase URL from the stored path', () => {
    const src = resolveImageSrc({ storage_path: `products/${PRODUCT}/a.webp`, storage_provider: 'supabase', image_url: null });
    expect(src).toBe(`${SUPABASE}/storage/v1/object/public/product-images/products/${PRODUCT}/a.webp`);
  });

  it('uses the saved delivery URL for an ImageKit image', () => {
    const src = resolveImageSrc({
      storage_path: `/products/${PRODUCT}/a.webp`,
      storage_provider: 'imagekit',
      image_url: 'https://ik.imagekit.io/shop1/products/x/a.webp',
    });
    expect(src).toBe('https://ik.imagekit.io/shop1/products/x/a.webp');
  });

  it('falls back to the Supabase URL when the provider is missing (older rows)', () => {
    const src = resolveImageSrc({ storage_path: `products/${PRODUCT}/a.webp` });
    expect(src).toContain('/storage/v1/object/public/product-images/');
  });

  it('returns null for a missing image or an ImageKit row with no URL', () => {
    expect(resolveImageSrc(null)).toBeNull();
    expect(resolveImageSrc(undefined)).toBeNull();
    expect(resolveImageSrc({ storage_path: 'x', storage_provider: 'imagekit', image_url: '   ' })).toBeNull();
    expect(resolveImageSrc({ storage_path: 'x', storage_provider: 'imagekit', image_url: null })).toBeNull();
  });

  it('resolves a catalogue row the same way', () => {
    expect(resolveCatalogImageSrc({ image_path: null })).toBeNull();
    expect(
      resolveCatalogImageSrc({ image_path: '/p/a.webp', image_provider: 'imagekit', image_url: 'https://ik.imagekit.io/s/a.webp' }),
    ).toBe('https://ik.imagekit.io/s/a.webp');
    expect(resolveCatalogImageSrc({ image_path: `products/${PRODUCT}/a.webp`, image_provider: 'supabase', image_url: null })).toContain(
      '/product-images/',
    );
  });
});

describe('next/image loader', () => {
  const originalEndpoint = process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  const originalSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = originalEndpoint;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabase;
  });

  it('adds a resize to an ImageKit delivery URL', () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/shop1';
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
    expect(imageLoader({ src: 'https://ik.imagekit.io/shop1/products/x/a.webp', width: 640, quality: 80 })).toBe(
      'https://ik.imagekit.io/shop1/products/x/a.webp?tr=w-640,q-80,f-auto',
    );
  });

  it('rewrites a Supabase bucket URL through ImageKit when configured', () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/shop1';
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
    expect(imageLoader({ src: `${SUPABASE}/storage/v1/object/public/product-images/a.webp`, width: 320 })).toBe(
      'https://ik.imagekit.io/shop1/storage/v1/object/public/product-images/a.webp?tr=w-320,q-75,f-auto',
    );
  });

  it('leaves every URL alone when ImageKit is not configured', () => {
    delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
    process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE;
    const supabaseSrc = `${SUPABASE}/storage/v1/object/public/product-images/a.webp`;
    expect(imageLoader({ src: supabaseSrc, width: 640 })).toBe(supabaseSrc);
    expect(imageLoader({ src: 'https://ik.imagekit.io/shop1/a.webp', width: 640 })).toBe('https://ik.imagekit.io/shop1/a.webp');
  });

  it('does not touch a URL from another host', () => {
    process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/shop1';
    expect(imageLoader({ src: 'https://example.com/a.webp', width: 640 })).toBe('https://example.com/a.webp');
  });
});
