import { ShopImage } from '@/components/shop-image';
import Link from 'next/link';
import { AvailabilityBadge } from '@/components/ui/primitives';
import { IconBox } from '@/components/ui/icons';
import { PriceLine } from './price';
import { PartTypeBadge } from './part-type-tabs';
import { AddToCartButton } from '@/components/cart/add-to-cart';
import { resolveCatalogImageSrc } from '@/lib/image-source';
import { SUPPLY_LABEL, suppliesOf, type Supply } from '@/lib/part-types';
import { formatINR, priceForSupply } from '@/lib/pricing';
import { buttonClasses } from '@/components/ui/button';
import type { CatalogItem } from '@/lib/types';

export function PhotoPlaceholder({ label = 'Photo coming soon', className = '' }: { label?: string; className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(135deg,var(--color-ivory-100)_0_10px,var(--color-ivory-200)_10px_11px)] text-stone-500 ${className}`}
    >
      <IconBox width={24} height={24} />
      <span className="px-2 text-center font-display text-[0.6875rem] font-semibold uppercase tracking-[0.12em] sm:text-xs">{label}</span>
    </div>
  );
}

export function ProductCard({
  item,
  priority = false,
  supply,
}: {
  item: CatalogItem;
  priority?: boolean;
  /** The tab the customer is on, so the matching price is shown. */
  supply?: Supply;
}) {
  const src = resolveCatalogImageSrc(item);
  const options = suppliesOf(item.part_type);
  // With no tab chosen, a part held from both supplies shows both prices and
  // sends the customer to the page to pick, rather than guessing for them.
  const choose = options.length > 1 && !supply;
  const shown = priceForSupply(item.supplyPricing, supply ?? options[0]);
  const alternative = choose ? item.supplyPricing.vendor : null;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white shadow-[var(--shadow-plate)] transition-shadow hover:shadow-[0_1px_0_rgb(20_21_23/0.04),0_14px_30px_-14px_rgb(20_21_23/0.35)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-ivory-100">
        {src ? (
          <ShopImage
            src={src}
            alt={item.image_alt || item.name}
            fill
            sizes="(min-width: 1024px) 280px, 48vw"
            className="object-contain p-3 transition-transform duration-300 group-hover:scale-[1.03]"
            priority={priority}
          />
        ) : (
          <PhotoPlaceholder />
        )}
        {item.is_featured && (
          <span className="absolute left-2.5 top-2.5 rounded-sm bg-ink px-2 py-0.5 font-display text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-bronze-300">
            Featured
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-graphite-900/10 p-3 sm:gap-2 sm:p-4">
        {item.category_name && (
          <p className="font-display text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-bronze-700 sm:text-xs">{item.category_name}</p>
        )}
        <h3 className="font-sans text-[0.9375rem] font-semibold leading-snug text-ink [overflow-wrap:anywhere] sm:text-[1.0625rem]">
          <Link href={`/products/${item.slug}`} className="after:absolute after:inset-0 focus:outline-none">
            {item.name}
          </Link>
        </h3>
        {item.part_number && <p className="font-mono text-[0.6875rem] text-stone-600 [overflow-wrap:anywhere] sm:text-xs">Part no. {item.part_number}</p>}
        <div className="pt-1">
          <PriceLine pricing={shown} />
          {alternative && (
            <p className="mt-0.5 text-xs text-stone-600">
              {SUPPLY_LABEL.oem} price · {SUPPLY_LABEL.vendor}{' '}
              {alternative.price === null ? 'on enquiry' : formatINR(alternative.price)}
            </p>
          )}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <AvailabilityBadge value={item.availability} />
          <PartTypeBadge type={item.part_type} />
        </div>
        <div className="relative z-10 pt-2">
          {choose ? (
            <Link href={`/products/${item.slug}`} className={buttonClasses('outline', 'sm', 'w-full')}>
              Choose OEM or vendor
            </Link>
          ) : (
            <AddToCartButton
              item={{
                productId: item.id,
                slug: item.slug,
                name: item.name,
                partNumber: item.part_number,
                unitPrice: shown.price,
                partType: supply ?? options[0],
              }}
              size="sm"
            />
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({
  items,
  priorityCount = 0,
  supply,
}: {
  items: CatalogItem[];
  priorityCount?: number;
  supply?: Supply;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, i) => (
        <li key={item.id}>
          <ProductCard item={item} priority={i < priorityCount} supply={supply} />
        </li>
      ))}
    </ul>
  );
}
