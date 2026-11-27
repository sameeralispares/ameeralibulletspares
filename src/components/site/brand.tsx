import { ShopImage } from '@/components/shop-image';
import Link from 'next/link';
import badge from '../../../public/brand/sameerali-badge.png';

/** The owner-supplied S Ameer Ali badge. Detailed artwork, so it is used on dark backgrounds. */
export function LogoBadge({ className = '', priority = false, sizes = '160px' }: { className?: string; priority?: boolean; sizes?: string }) {
  return (
    <ShopImage
      src={badge}
      alt="S Ameer Ali — Royal Enfield spare shop badge"
      className={className}
      priority={priority}
      sizes={sizes}
      placeholder="empty"
    />
  );
}

/** Header/footer brand: the badge plus the shop name in text (for readability and SEO). */
export function BrandMark({ tone = 'light', compact = false }: { tone?: 'light' | 'dark'; compact?: boolean }) {
  const onDark = tone === 'dark';
  return (
    <Link href="/" className="group inline-flex items-center gap-2.5" aria-label="S Ameer Ali Bullet Spare Parts — home">
      <ShopImage src={badge} alt="" priority sizes="48px" className="h-11 w-auto shrink-0 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-[1.375rem] font-bold uppercase tracking-[0.06em] ${
            onDark ? 'text-ivory-50' : 'text-ink'
          }`}
        >
          S Ameer Ali
        </span>
        {!compact && (
          <span
            className={`mt-1 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.2em] ${
              onDark ? 'text-bronze-300' : 'text-bronze-700'
            }`}
          >
            Bullet Spare Parts<span className="hidden min-[400px]:inline"> · Chennai</span>
          </span>
        )}
      </span>
    </Link>
  );
}
