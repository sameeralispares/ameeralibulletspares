import Image, { type ImageProps } from 'next/image';
import { canResizeImage } from '@/lib/imagekit-loader';

/**
 * `next/image` for this shop. The custom ImageKit loader can only resize URLs
 * it recognises. For anything else (local static imports, Supabase photos when
 * the ImageKit proxy is off) the loader returns the source unchanged, which
 * Next.js reports as a warning. Those images are rendered `unoptimized`, which
 * serves the original file exactly as the loader already would.
 */
export function ShopImage(props: ImageProps) {
  const { src, alt, unoptimized, ...rest } = props;
  const url = typeof src === 'string' ? src : 'default' in src ? src.default.src : src.src;
  return <Image src={src} alt={alt} unoptimized={unoptimized ?? !canResizeImage(url)} {...rest} />;
}
