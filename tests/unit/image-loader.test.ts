import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { canResizeImage } from '../../src/lib/imagekit-loader';

const SUPABASE = 'https://abcdefgh.supabase.co';
const PHOTO = `${SUPABASE}/storage/v1/object/public/product-images/part-1.webp`;
const ENDPOINT = 'https://ik.imagekit.io/sameerali';

const original = {
  endpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT,
  supabase: process.env.NEXT_PUBLIC_SUPABASE_URL,
};

function setEnv(endpoint: string | undefined, supabase: string | undefined) {
  if (endpoint === undefined) delete process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT;
  else process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT = endpoint;
  if (supabase === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = supabase;
}

describe('canResizeImage', () => {
  beforeEach(() => setEnv(undefined, undefined));
  afterEach(() => setEnv(original.endpoint, original.supabase));

  it('resizes Supabase photos when ImageKit is the web proxy in front of Supabase', () => {
    setEnv(ENDPOINT, SUPABASE);
    expect(canResizeImage(PHOTO)).toBe(true);
  });

  it('resizes ImageKit media-library delivery URLs', () => {
    setEnv(ENDPOINT, SUPABASE);
    expect(canResizeImage(`${ENDPOINT}/shop/part.webp`)).toBe(true);
  });

  it('does not resize Supabase photos when no ImageKit endpoint is configured', () => {
    setEnv(undefined, SUPABASE);
    expect(canResizeImage(PHOTO)).toBe(false);
  });

  it('does not resize local static imports (the logo badge, bundled assets)', () => {
    setEnv(ENDPOINT, SUPABASE);
    expect(canResizeImage('/_next/static/media/sameerali-badge.abc123.png')).toBe(false);
  });

  it('does not resize URLs from other hosts', () => {
    setEnv(ENDPOINT, SUPABASE);
    expect(canResizeImage('https://example.com/photo.webp')).toBe(false);
  });
});
