import Link from 'next/link';
import { IconChevronLeft, IconChevronRight } from '@/components/ui/icons';

export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  const cls =
    'inline-flex min-h-11 items-center gap-1 rounded-md border border-graphite-900/15 bg-white px-4 font-display text-sm font-semibold uppercase tracking-[0.08em] hover:border-graphite-900';
  return (
    <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cls} rel="prev">
          <IconChevronLeft width={16} height={16} /> Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-stone-600">
        Page <span className="font-semibold text-ink">{page}</span> of {pageCount}
      </p>
      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cls} rel="next">
          Next <IconChevronRight width={16} height={16} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
