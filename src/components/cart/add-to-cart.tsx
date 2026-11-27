'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, buttonClasses } from '@/components/ui/button';
import { IconCart, IconCheck } from '@/components/ui/icons';
import { lineKey } from '@/lib/cart';
import type { Supply } from '@/lib/part-types';
import { useCart } from './cart-context';

type Props = {
  item: {
    productId: string;
    slug: string;
    name: string;
    partNumber: string | null;
    unitPrice: number | null;
    partType: Supply;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/** Adds the part to the cart. Shows a confirmation with a link to the cart. */
export function AddToCartButton({ item, size = 'lg', className = '' }: Props) {
  const { lines, add, ready } = useCart();
  const [status, setStatus] = useState<'idle' | 'added' | 'full'>('idle');
  const inCart = lines.find((l) => lineKey(l) === lineKey(item));

  function onAdd() {
    const result = add(item);
    setStatus(result === 'full' ? 'full' : 'added');
  }

  if (status === 'full') {
    return (
      <p role="status" className="text-sm text-stone-700">
        Your cart is full. Please send this order first, or <Link href="/cart" className="font-semibold underline">review your cart</Link>.
      </p>
    );
  }

  if (status === 'added' || inCart) {
    return (
      <div role="status" className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok-700">
          <IconCheck width={18} height={18} /> Added to your cart{inCart && inCart.qty > 1 ? ` (${inCart.qty})` : ''}
        </span>
        <Link href="/cart" className={buttonClasses('outline', size, 'w-full sm:w-auto')}>
          <IconCart /> View cart
        </Link>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size={size}
      className={`w-full ${className}`}
      onClick={onAdd}
      disabled={!ready}
      aria-label={`Add ${item.name} to cart`}
    >
      <IconCart /> Add to cart
    </Button>
  );
}
