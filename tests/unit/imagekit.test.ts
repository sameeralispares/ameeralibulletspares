import { describe, expect, it } from 'vitest';
import { imageKitSettings, imageKitUrl } from '@/lib/imagekit';

const SUPABASE = 'https://abcdefgh.supabase.co';
const cfg = imageKitSettings('https://ik.imagekit.io/shop1/', SUPABASE);

describe('ImageKit settings', () => {
  it('accepts an https endpoint and normalises the trailing slash', () => {
    expect(cfg).toEqual({ endpoint: 'https://ik.imagekit.io/shop1', supabaseOrigin: SUPABASE });
  });

  it('is disabled when the endpoint is missing, insecure or malformed', () => {
    expect(imageKitSettings(undefined, SUPABASE)).toBeNull();
    expect(imageKitSettings('', SUPABASE)).toBeNull();
    expect(imageKitSettings('http://ik.imagekit.io/shop1', SUPABASE)).toBeNull();
    expect(imageKitSettings('https://ik.imagekit.io/shop1?x=1', SUPABASE)).toBeNull();
    expect(imageKitSettings('not a url', SUPABASE)).toBeNull();
    expect(imageKitSettings('https://ik.imagekit.io/shop1', undefined)).toBeNull();
  });
});

describe('ImageKit URLs', () => {
  const photo = `${SUPABASE}/storage/v1/object/public/product-images/products/1/a.webp`;

  it('rewrites a Supabase bucket photo to the ImageKit endpoint with resize, quality and auto format', () => {
    expect(imageKitUrl(photo, 640, 80, cfg)).toBe(
      'https://ik.imagekit.io/shop1/storage/v1/object/public/product-images/products/1/a.webp?tr=w-640,q-80,f-auto',
    );
  });

  it('rounds the width and clamps the quality', () => {
    expect(imageKitUrl(photo, 299.6, 0, cfg)).toContain('?tr=w-300,q-75,f-auto');
    expect(imageKitUrl(photo, 0, 500, cfg)).toContain('?tr=w-1,q-100,f-auto');
  });

  it('leaves other URLs and disabled configuration untouched', () => {
    const other = 'https://example.com/photo.jpg';
    expect(imageKitUrl(other, 640, 80, cfg)).toBe(other);
    expect(imageKitUrl('/brand/sameerali-badge.png', 64, 75, cfg)).toBe('/brand/sameerali-badge.png');
    expect(imageKitUrl(photo, 640, 80, null)).toBe(photo);
  });

  it('does not rewrite a different Supabase project or a private bucket path', () => {
    const otherProject = 'https://zzzz.supabase.co/storage/v1/object/public/product-images/x.webp';
    expect(imageKitUrl(otherProject, 640, 80, cfg)).toBe(otherProject);
    const signed = `${SUPABASE}/storage/v1/object/sign/product-images/x.webp`;
    expect(imageKitUrl(signed, 640, 80, cfg)).toBe(signed);
  });
});

/* ------------------------------------------------------------------ */
/* Server-side operations. No ImageKit account is needed: every call   */
/* takes the fetch implementation as an argument.                      */
/* ------------------------------------------------------------------ */

import {
  IMAGEKIT_API_BASE,
  IMAGEKIT_UPLOAD_URL,
  checkImageKitAccount,
  deleteFromImageKit,
  fetchImageKitUsage,
  formatBytes,
  imageKitAuthHeader,
  imageKitDeliveryUrl,
  imageKitFolder,
  normaliseEndpoint,
  uploadToImageKit,
} from '@/lib/imagekit';

const CREDS = { endpoint: 'https://ik.imagekit.io/shop1', privateKey: 'private_test_key' };
const PRODUCT_ID = '11111111-2222-4333-8444-555555555555';

/** Records what was requested and replies with a canned response. */
function fakeFetch(reply: { status: number; body?: unknown; text?: string; throws?: boolean }) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (reply.throws) throw new Error('network down');
    return {
      ok: reply.status >= 200 && reply.status < 300,
      status: reply.status,
      json: async () => {
        if (reply.body === undefined) throw new Error('not json');
        return reply.body;
      },
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const UPLOAD_OK = {
  fileId: 'file_123',
  filePath: `/products/${PRODUCT_ID}/abcd1234-aaaa.webp`,
  url: 'https://ik.imagekit.io/shop1/products/x/abcd1234-aaaa.webp',
  name: 'abcd1234-aaaa.webp',
  size: 20480,
  fileType: 'image',
  width: 1600,
  height: 1200,
};

const UPLOAD_INPUT = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  fileName: 'abcd1234-aaaa.webp',
  folder: `products/${PRODUCT_ID}`,
  mimeType: 'image/webp',
};

describe('credentials and paths', () => {
  it('sends the private key as HTTP Basic with an empty password', () => {
    expect(imageKitAuthHeader('private_abc')).toBe(`Basic ${Buffer.from('private_abc:').toString('base64')}`);
    // The key itself never appears in plain text in the header value.
    expect(imageKitAuthHeader('private_abc')).not.toContain('private_abc');
  });

  it('mirrors the Supabase bucket folder layout', () => {
    expect(imageKitFolder(PRODUCT_ID)).toBe(`products/${PRODUCT_ID}`);
  });

  it('normalises a URL endpoint and rejects anything unusable', () => {
    expect(normaliseEndpoint('https://ik.imagekit.io/shop1/')).toBe('https://ik.imagekit.io/shop1');
    expect(normaliseEndpoint('  https://ik.imagekit.io/shop1  ')).toBe('https://ik.imagekit.io/shop1');
    expect(normaliseEndpoint('http://ik.imagekit.io/shop1')).toBeNull();
    expect(normaliseEndpoint('https://ik.imagekit.io/shop1?x=1')).toBeNull();
    expect(normaliseEndpoint('nonsense')).toBeNull();
    expect(normaliseEndpoint(undefined)).toBeNull();
  });

  it('formats byte counts for the settings page', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GB');
  });
});

describe('delivery URL for a media library file', () => {
  it('adds the transformation to a URL under the endpoint', () => {
    expect(imageKitDeliveryUrl('https://ik.imagekit.io/shop1/a.webp', 480, 70, 'https://ik.imagekit.io/shop1')).toBe(
      'https://ik.imagekit.io/shop1/a.webp?tr=w-480,q-70,f-auto',
    );
  });

  it('leaves other hosts, missing endpoints and already-transformed URLs alone', () => {
    expect(imageKitDeliveryUrl('https://example.com/a.webp', 480, 70, 'https://ik.imagekit.io/shop1')).toBe(
      'https://example.com/a.webp',
    );
    expect(imageKitDeliveryUrl('https://ik.imagekit.io/shop1/a.webp', 480, 70, null)).toBe('https://ik.imagekit.io/shop1/a.webp');
    expect(imageKitDeliveryUrl('https://ik.imagekit.io/shop1/a.webp?tr=w-100', 480, 70, 'https://ik.imagekit.io/shop1')).toBe(
      'https://ik.imagekit.io/shop1/a.webp?tr=w-100',
    );
  });
});

describe('upload to ImageKit', () => {
  it('posts the file to the upload endpoint with Basic auth and a fixed file name', async () => {
    const { impl, calls } = fakeFetch({ status: 200, body: UPLOAD_OK });
    const result = await uploadToImageKit(CREDS, UPLOAD_INPUT, impl);

    expect(result).toEqual({ ok: true, value: UPLOAD_OK });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(IMAGEKIT_UPLOAD_URL);
    expect(calls[0].init?.method).toBe('POST');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.authorization).toBe(imageKitAuthHeader(CREDS.privateKey));

    const body = calls[0].init?.body as FormData;
    expect(body.get('fileName')).toBe('abcd1234-aaaa.webp');
    expect(body.get('folder')).toBe(`products/${PRODUCT_ID}`);
    // Off, so the stored path stays predictable (the name already has a UUID).
    expect(body.get('useUniqueFileName')).toBe('false');
    expect(body.get('file')).toBeInstanceOf(Blob);
  });

  it('reports the message ImageKit gave when it refuses the upload', async () => {
    const { impl } = fakeFetch({ status: 400, body: { message: 'Your account is over its storage limit' } });
    const result = await uploadToImageKit(CREDS, UPLOAD_INPUT, impl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('over its storage limit');
  });

  it('points at the key when ImageKit rejects the credentials', async () => {
    for (const status of [401, 403]) {
      const { impl } = fakeFetch({ status, body: { message: 'unauthorized' } });
      const result = await uploadToImageKit(CREDS, UPLOAD_INPUT, impl);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('private key');
    }
  });

  it('fails cleanly when ImageKit cannot be reached', async () => {
    const { impl } = fakeFetch({ status: 200, throws: true });
    const result = await uploadToImageKit(CREDS, UPLOAD_INPUT, impl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('could not be reached');
  });

  it('fails when the response is not JSON or lacks a file id and URL', async () => {
    const noJson = await uploadToImageKit(CREDS, UPLOAD_INPUT, fakeFetch({ status: 200 }).impl);
    expect(noJson.ok).toBe(false);

    const wrongShape = await uploadToImageKit(CREDS, UPLOAD_INPUT, fakeFetch({ status: 200, body: { url: 'x' } }).impl);
    expect(wrongShape.ok).toBe(false);
    if (!wrongShape.ok) expect(wrongShape.error).toContain('file id');
  });
});

describe('delete from ImageKit', () => {
  it('deletes by file id', async () => {
    const { impl, calls } = fakeFetch({ status: 204 });
    const result = await deleteFromImageKit(CREDS, 'file_123', impl);
    expect(result).toEqual({ ok: true, value: 'deleted' });
    expect(calls[0].url).toBe(`${IMAGEKIT_API_BASE}/files/file_123`);
    expect(calls[0].init?.method).toBe('DELETE');
  });

  it('treats a file that is already gone as success', async () => {
    const { impl } = fakeFetch({ status: 404, body: { message: 'The requested file does not exist.' } });
    expect(await deleteFromImageKit(CREDS, 'file_123', impl)).toEqual({ ok: true, value: 'already-gone' });
  });

  it('escapes the file id in the URL', async () => {
    const { impl, calls } = fakeFetch({ status: 204 });
    await deleteFromImageKit(CREDS, 'a/../b', impl);
    expect(calls[0].url).toBe(`${IMAGEKIT_API_BASE}/files/a%2F..%2Fb`);
  });

  it('reports a failure instead of pretending the file is gone', async () => {
    const failed = await deleteFromImageKit(CREDS, 'file_123', fakeFetch({ status: 500, body: { message: 'server error' } }).impl);
    expect(failed.ok).toBe(false);

    const offline = await deleteFromImageKit(CREDS, 'file_123', fakeFetch({ status: 200, throws: true }).impl);
    expect(offline.ok).toBe(false);
    if (!offline.ok) expect(offline.error).toContain('not deleted');
  });
});

describe('connection status', () => {
  it('says not configured when there are no credentials', async () => {
    const status = await checkImageKitAccount(null, fakeFetch({ status: 200, body: [] }).impl);
    expect(status).toMatchObject({ provider: 'imagekit', state: 'not-configured' });
    expect(status.detail).toContain('IMAGEKIT_PRIVATE_KEY');
  });

  it('checks the account for real and reports the endpoint', async () => {
    const { impl, calls } = fakeFetch({ status: 200, body: [] });
    const status = await checkImageKitAccount(CREDS, impl);
    expect(status).toMatchObject({ provider: 'imagekit', state: 'ready' });
    expect(status.detail).toContain(CREDS.endpoint);
    expect(calls[0].url).toBe(`${IMAGEKIT_API_BASE}/files?limit=1`);
  });

  it('reports a bad key, a server error and an unreachable API as problems', async () => {
    const badKey = await checkImageKitAccount(CREDS, fakeFetch({ status: 401 }).impl);
    expect(badKey.state).toBe('error');
    expect(badKey.detail).toContain('IMAGEKIT_PRIVATE_KEY');

    expect((await checkImageKitAccount(CREDS, fakeFetch({ status: 500 }).impl)).state).toBe('error');
    expect((await checkImageKitAccount(CREDS, fakeFetch({ status: 200, throws: true }).impl)).state).toBe('error');
  });

  it('never reveals the private key in the status detail', async () => {
    const status = await checkImageKitAccount(CREDS, fakeFetch({ status: 401 }).impl);
    expect(status.detail).not.toContain(CREDS.privateKey);
  });
});

describe('usage reporting', () => {
  it('reports usage when the account exposes it', async () => {
    const { impl } = fakeFetch({ status: 200, body: { mediaLibraryStorageUsage: 5 * 1024 * 1024, bandwidthBytes: 1024 * 1024 } });
    expect(await fetchImageKitUsage(CREDS, impl)).toBe('5.0 MB stored · 1.0 MB delivered in 30 days');
  });

  it('returns nothing (so the page can say "Usage unavailable") rather than inventing a value', async () => {
    expect(await fetchImageKitUsage(null, fakeFetch({ status: 200, body: {} }).impl)).toBeNull();
    expect(await fetchImageKitUsage(CREDS, fakeFetch({ status: 403, body: { message: 'no permission' } }).impl)).toBeNull();
    expect(await fetchImageKitUsage(CREDS, fakeFetch({ status: 200, body: { nonsense: true } }).impl)).toBeNull();
    expect(await fetchImageKitUsage(CREDS, fakeFetch({ status: 200, throws: true }).impl)).toBeNull();
  });
});
