import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import { CartView } from '@/components/cart/cart-view';

export const metadata: Metadata = pageMetadata({
  title: 'Your cart',
  description: 'Review the genuine Royal Enfield parts in your cart before sending the order to the shop on WhatsApp.',
  path: '/cart',
  noindex: true,
});

export default function CartPage() {
  return <CartView />;
}
