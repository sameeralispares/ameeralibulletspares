import 'server-only';

/**
 * Server-side ImageKit credentials.
 *
 * IMAGEKIT_PRIVATE_KEY is a secret and is read only here, in code that never
 * reaches the browser. It is deliberately not a NEXT_PUBLIC_ variable.
 *
 * The URL endpoint is not a secret: it appears in every delivery URL on the
 * page. NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT is used by the image loader in the
 * browser, and is accepted here as a fallback so one value can serve both.
 */
import { type ImageKitCredentials, normaliseEndpoint } from './imagekit';

export function imageKitEndpoint(): string | null {
  return (
    normaliseEndpoint(process.env.IMAGEKIT_URL_ENDPOINT) ??
    normaliseEndpoint(process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT)
  );
}

/** Returns credentials only when ImageKit is fully configured on the server. */
export function imageKitCredentials(): ImageKitCredentials | null {
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  const endpoint = imageKitEndpoint();
  if (!privateKey || !endpoint) return null;
  return { endpoint, privateKey };
}

/** True when uploads to ImageKit are possible. Safe to report to the admin. */
export function isImageKitConfigured(): boolean {
  return imageKitCredentials() !== null;
}

/**
 * Which pieces of configuration are missing, for the settings page. Never
 * returns any part of a key.
 */
export function imageKitConfigGaps(): string[] {
  const gaps: string[] = [];
  if (!process.env.IMAGEKIT_PRIVATE_KEY?.trim()) gaps.push('IMAGEKIT_PRIVATE_KEY');
  if (!imageKitEndpoint()) gaps.push('IMAGEKIT_URL_ENDPOINT');
  return gaps;
}
