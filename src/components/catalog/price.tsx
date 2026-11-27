import { formatINR, type PriceView } from '@/lib/pricing';

/**
 * Price in rupees. Shows the price the customer pays, the MRP struck through
 * when there is an offer, and the saving. Parts without an MRP say "Price on
 * enquiry" rather than showing an invented figure.
 */
export function PriceLine({ pricing, size = 'sm' }: { pricing: PriceView; size?: 'sm' | 'lg' }) {
  if (pricing.price === null) {
    return <p className={size === 'lg' ? 'text-base font-semibold text-stone-700' : 'text-sm font-semibold text-stone-700'}>Price on enquiry</p>;
  }

  const priceClass =
    size === 'lg' ? 'font-display text-[1.75rem] font-bold leading-none text-ink' : 'font-display text-lg font-bold leading-none text-ink';

  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className={priceClass} aria-label={`Price ${formatINR(pricing.price)}`}>
        {formatINR(pricing.price)}
      </span>
      {pricing.onOffer && pricing.original !== null ? (
        <>
          <span className="text-sm text-stone-600">
            MRP <s>{formatINR(pricing.original)}</s>
          </span>
          {pricing.savePercent !== null && pricing.savePercent > 0 && (
            <span className="rounded-sm bg-bronze-100 px-1.5 py-0.5 font-display text-xs font-semibold uppercase tracking-[0.08em] text-bronze-800">
              Save {pricing.savePercent}%
            </span>
          )}
        </>
      ) : (
        <span className="text-sm text-stone-600">MRP</span>
      )}
    </div>
  );
}
