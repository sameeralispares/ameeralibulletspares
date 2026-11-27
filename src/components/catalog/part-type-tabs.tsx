import Link from 'next/link';
import {
  PART_TYPE_LABEL,
  SUPPLY_BLURB,
  SUPPLY_LABEL,
  type PartType,
  type Supply,
} from '@/lib/part-types';

type Props = {
  /** Currently selected tab; undefined means "All parts". */
  active?: Supply;
  hrefFor: (supply: Supply | undefined) => string;
  counts: { all: number; oem: number; vendor: number };
};

/**
 * OEM / Vendor tabs over a catalogue list. Both are genuine parts; the tabs
 * split them by which supply the shop bought them through, and a part held
 * from both supplies appears under each. Plain links, so the list works
 * without JavaScript and each tab is a shareable URL.
 */
export function PartTypeTabs({ active, hrefFor, counts }: Props) {
  const tabs: { key: Supply | undefined; label: string; count: number }[] = [
    { key: undefined, label: 'All parts', count: counts.all },
    { key: 'oem', label: SUPPLY_LABEL.oem, count: counts.oem },
    { key: 'vendor', label: SUPPLY_LABEL.vendor, count: counts.vendor },
  ];

  return (
    <div>
      <nav aria-label="OEM or vendor stock" data-testid="part-type-tabs">
        <ul className="flex flex-wrap gap-1 rounded-[var(--radius-plate)] border border-graphite-900/12 bg-ivory-100 p-1">
          {tabs.map((tab) => {
            const selected = tab.key === active;
            return (
              <li key={tab.label} className="flex-1 sm:flex-none">
                <Link
                  href={hrefFor(tab.key)}
                  scroll={false}
                  aria-current={selected ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-center gap-1.5 rounded-md px-4 text-sm font-semibold transition-colors ${
                    selected ? 'bg-ink text-bronze-300 shadow-sm' : 'text-stone-700 hover:bg-white'
                  }`}
                >
                  {tab.label}
                  <span className={selected ? 'text-ivory-200/70' : 'text-stone-500'}>({tab.count})</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {active && (
        <p className="mt-2 text-sm text-stone-600" data-testid="part-type-blurb">
          {SUPPLY_BLURB[active]}
        </p>
      )}
    </div>
  );
}

/**
 * Which supply a part is held from. Both are genuine, so neither reads as the
 * better one: the same neutral treatment for each.
 */
export function PartTypeBadge({ type, className = '' }: { type: PartType; className?: string }) {
  return (
    <span
      data-testid="part-type-badge"
      title={type === 'both' ? 'Held as OEM stock and as vendor stock' : SUPPLY_BLURB[type]}
      className={`inline-flex items-center rounded border border-graphite-900/15 bg-ivory-100 px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-stone-700 ${className}`}
    >
      {PART_TYPE_LABEL[type]}
    </span>
  );
}
