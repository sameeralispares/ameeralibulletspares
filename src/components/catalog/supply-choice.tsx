'use client';

import { useState } from 'react';
import { PriceLine } from './price';
import { AddToCartButton } from '@/components/cart/add-to-cart';
import { SUPPLY_BLURB, SUPPLY_LABEL, suppliesOf, type PartType, type Supply } from '@/lib/part-types';
import { formatINR, priceForSupply, type SupplyPrices } from '@/lib/pricing';

type Props = {
  product: { id: string; slug: string; name: string; part_number: string | null; part_type: PartType };
  prices: SupplyPrices;
  /** Which option to open on, from the tab the customer arrived through. */
  initial?: Supply;
};

/**
 * Price and Add to cart for one part.
 *
 * A part the shop holds from both supplies shows a choice: the customer picks
 * OEM or vendor, the price follows, and the order carries the choice so the
 * shop knows which stock to pull.
 */
export function SupplyChoice({ product, prices, initial }: Props) {
  const options = suppliesOf(product.part_type);
  const [supply, setSupply] = useState<Supply>(
    initial && options.includes(initial) ? initial : options[0],
  );
  const chosen = priceForSupply(prices, supply);

  if (options.length < 2) {
    return (
      <>
        <div className="mt-5">
          <PriceLine pricing={chosen} size="lg" />
        </div>
        <div className="mt-7">
          <AddToCartButton
            item={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              partNumber: product.part_number,
              unitPrice: chosen.price,
              partType: options[0],
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <fieldset className="mt-5" data-testid="supply-choice">
        <legend className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">
          Choose the stock you want
        </legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {options.map((option) => {
            const view = priceForSupply(prices, option);
            const selected = option === supply;
            return (
              <label
                key={option}
                className={`relative flex min-h-[4.5rem] cursor-pointer flex-col justify-center rounded-[var(--radius-plate)] border px-4 py-3 transition-colors ${
                  selected ? 'border-bronze-500 bg-bronze-50/60 ring-1 ring-bronze-500' : 'border-graphite-900/15 bg-white hover:border-bronze-400'
                }`}
              >
                <input
                  type="radio"
                  name="supply"
                  value={option}
                  checked={selected}
                  onChange={() => setSupply(option)}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                />
                <span className="pointer-events-none font-display text-sm font-bold uppercase tracking-[0.08em]">
                  {SUPPLY_LABEL[option]}
                </span>
                <span className="pointer-events-none mt-1 font-display text-xl font-bold leading-none text-ink">
                  {view.price === null ? 'On enquiry' : formatINR(view.price)}
                </span>
                {view.onOffer && view.original !== null && (
                  <span className="pointer-events-none mt-1 text-xs text-stone-600">
                    MRP <s>{formatINR(view.original)}</s>
                    {view.savePercent ? ` · save ${view.savePercent}%` : ''}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-stone-600" aria-live="polite">
          {SUPPLY_BLURB[supply]}
        </p>
      </fieldset>

      <div className="mt-6">
        <AddToCartButton
          // A fresh button per supply, so switching never adds the wrong stock.
          key={supply}
          item={{
            productId: product.id,
            slug: product.slug,
            name: `${product.name} (${SUPPLY_LABEL[supply]})`,
            partNumber: product.part_number,
            unitPrice: chosen.price,
            partType: supply,
          }}
        />
      </div>
    </>
  );
}
