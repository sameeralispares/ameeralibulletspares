'use client';

import Link from 'next/link';
import { IconCart } from '@/components/ui/icons';
import { useCart } from './cart-context';

/** Header cart icon with the number of parts in the cart. */
export function CartButton() {
  const { count, ready } = useCart();
  const label = ready && count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart';
  return (
    <Link
      href="/cart"
      className="relative grid h-11 w-11 place-items-center rounded-md text-ivory-50 hover:bg-white/10"
      aria-label={label}
      title="View cart"
    >
      <IconCart width={22} height={22} />
      {ready && count > 0 && (
        <span
          aria-hidden="true"
          className="absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-bronze-500 px-1 font-display text-[0.6875rem] font-bold leading-none text-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
}
