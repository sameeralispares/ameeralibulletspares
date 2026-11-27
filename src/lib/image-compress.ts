/**
 * In-browser image optimisation before upload: phone photos (often 4–12 MB)
 * are resized to at most 1600px on the long edge and re-encoded as WebP
 * (JPEG fallback on browsers that can't encode WebP). This keeps storage
 * small and pages fast, and strips location/EXIF metadata as a side effect.
 */
export const MAX_EDGE = 1600;

export type CompressedImage = { blob: Blob; width: number; height: number; ext: 'webp' | 'jpg' | 'png' };

export type CompressOptions = {
  /** Long-edge limit in pixels (default MAX_EDGE). */
  maxEdge?: number;
  /**
   * Keep transparent areas (logos, badges). Transparent pixels are not filled
   * with white, and the fallback is PNG instead of JPEG.
   */
  keepTransparency?: boolean;
};

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<CompressedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('This photo format could not be read. Please use a JPG, PNG or WebP photo.');
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, opts.maxEdge ?? MAX_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process the photo.');
  if (!opts.keepTransparency) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const webp = await canvasToBlob(canvas, 'image/webp', 0.82);
  if (webp && webp.type === 'image/webp') return { blob: webp, width, height, ext: 'webp' };
  if (opts.keepTransparency) {
    const png = await canvasToBlob(canvas, 'image/png', 1);
    if (!png) throw new Error('Your browser could not process the photo.');
    return { blob: png, width, height, ext: 'png' };
  }
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  if (!jpeg) throw new Error('Your browser could not process the photo.');
  return { blob: jpeg, width, height, ext: 'jpg' };
}
