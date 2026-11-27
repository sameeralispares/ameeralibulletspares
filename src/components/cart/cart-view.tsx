'use client';

import Link from 'next/link';
import { Button, ButtonLink, buttonClasses } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';
import { IconTrash, IconWhatsApp } from '@/components/ui/icons';
import { cartTotal, lineKey, CART_MAX_QTY } from '@/lib/cart';
import { SUPPLY_LABEL } from '@/lib/part-types';
import { formatINR } from '@/lib/pricing';
import { useCart } from './cart-context';

/** Review step: quantities, prices and the total before the customer gives their details. */
export function CartView() {
  const { lines, ready, setQuantity, remove } = useCart();

  if (!ready) {
    return (
      <Container className="py-10">
        <div className="h-40 animate-pulse rounded bg-ivory-200/70" aria-hidden="true" />
      </Container>
    );
  }

  if (lines.length === 0) {
    return (
      <Container className="py-14 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">Your cart is empty</h1>
        <p className="mx-auto mt-3 max-w-md text-stone-600">Add genuine parts from the catalogue, then send your order to the shop on WhatsApp.</p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/products" variant="primary" size="lg">
            Browse parts
          </ButtonLink>
        </div>
      </Container>
    );
  }

  const totals = cartTotal(lines);

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">Your cart</h1>
      <p className="mt-2 text-stone-600">Check the parts and quantities. Next you will add your name and mobile number, then send the order to the shop on WhatsApp.</p>

      <ul className="mt-8 divide-y divide-graphite-900/10 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white">
        {lines.map((l) => (
          <li key={lineKey(l)} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0">
              <Link href={`/products/${l.slug}`} className="font-semibold text-ink hover:text-bronze-700 [overflow-wrap:anywhere]">
                {l.name}
              </Link>
              {l.partNumber && <p className="mt-0.5 font-mono text-xs text-stone-600">Part no. {l.partNumber}</p>}
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.06em] text-stone-600">{SUPPLY_LABEL[l.partType]} stock</p>
              <p className="mt-1 text-sm text-stone-700">
                {l.unitPrice === null ? 'Price on enquiry' : `${formatINR(l.unitPrice)} each`}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 sm:justify-end">
              <div className="inline-flex items-center rounded-md border border-graphite-900/20" role="group" aria-label={`Quantity for ${l.name}`}>
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center text-lg font-semibold hover:bg-ivory-100"
                  onClick={() => setQuantity(lineKey(l), l.qty - 1)}
                  aria-label={l.qty === 1 ? `Remove ${l.name}` : `Decrease quantity of ${l.name}`}
                >
                  −
                </button>
                <span className="min-w-10 text-center font-semibold" aria-live="polite">
                  {l.qty}
                </span>
                <button
                  type="button"
                  className="grid h-11 w-11 place-items-center text-lg font-semibold hover:bg-ivory-100 disabled:opacity-40"
                  onClick={() => setQuantity(lineKey(l), l.qty + 1)}
                  disabled={l.qty >= CART_MAX_QTY}
                  aria-label={`Increase quantity of ${l.name}`}
                >
                  +
                </button>
              </div>
              <p className="w-28 text-right font-display text-lg font-bold">
                {l.unitPrice === null ? 'On enquiry' : formatINR(l.unitPrice * l.qty)}
              </p>
              <button
                type="button"
                onClick={() => remove(lineKey(l))}
                className="grid h-11 w-11 place-items-center rounded-md text-stone-600 hover:bg-stop-50 hover:text-stop-700"
                aria-label={`Remove ${l.name} from cart`}
              >
                <IconTrash />
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col gap-4 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-ivory-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Total</p>
          <p className="font-display text-2xl font-bold">{formatINR(totals.pricedTotal)}</p>
          {!totals.allPriced && (
            <p className="mt-1 text-sm text-stone-700">
              {totals.unpricedLines} item{totals.unpricedLines === 1 ? '' : 's'} on enquiry. The shop will confirm their price.
            </p>
          )}
        </div>
        <ButtonLink href="/cart/order" variant="whatsapp" size="lg" className="w-full sm:w-auto">
          <IconWhatsApp width={22} height={22} /> Continue to order
        </ButtonLink>
      </div>

      <p className="mt-4 text-sm text-stone-600">
        Nothing is charged on the website. The shop confirms availability and the final price on WhatsApp.{' '}
        <Link href="/products" className={buttonClasses('ghost', 'sm', 'inline-flex px-0 underline')}>
          Add more parts
        </Link>
      </p>
    </Container>
  );
}

export function ClearCartButton() {
  const { clear, count } = useCart();
  if (count === 0) return null;
  return (
    <Button variant="outline" size="sm" onClick={clear}>
      Clear cart
    </Button>
  );
}
