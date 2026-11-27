import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Availability } from '@/lib/types';
import { availabilityLabel } from '@/lib/types';
import { absoluteUrl } from '@/lib/site';
import { IconChevronRight } from './icons';

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

const availabilityStyles: Record<Availability, { cls: string; dot: string }> = {
  available: { cls: 'bg-ok-50 text-ok-700 ring-ok-700/20', dot: 'bg-ok-700' },
  out_of_stock: { cls: 'bg-stop-50 text-stop-700 ring-stop-700/20', dot: 'bg-stop-700' },
  contact_to_confirm: { cls: 'bg-ask-50 text-ask-700 ring-ask-700/25', dot: 'bg-ask-700' },
};

/** Availability always comes from the database row — never hardcoded. */
export function AvailabilityBadge({ value, size = 'sm' }: { value: Availability; size?: 'sm' | 'md' }) {
  const s = availabilityStyles[value];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ring-1 ring-inset font-medium ${s.cls} ${
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {availabilityLabel(value)}
    </span>
  );
}

export type Crumb = { name: string; href: string };

/** Visible breadcrumbs + matching BreadcrumbList JSON-LD. */
export function Breadcrumbs({ items, tone = 'light' }: { items: Crumb[]; tone?: 'light' | 'dark' }) {
  const all = [{ name: 'Home', href: '/' }, ...items];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
  const muted = tone === 'dark' ? 'text-ivory-200/70 hover:text-ivory-50' : 'text-stone-600 hover:text-ink';
  const current = tone === 'dark' ? 'text-ivory-50' : 'text-ink';
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
          {all.map((c, i) => {
            const last = i === all.length - 1;
            return (
              <li key={c.href} className="flex items-center gap-1">
                {last ? (
                  <span aria-current="page" className={`${current} font-medium`}>
                    {c.name}
                  </span>
                ) : (
                  <>
                    <Link href={c.href} className={`${muted} -my-2 inline-flex min-h-10 items-center underline-offset-4 hover:underline`}>
                      {c.name}
                    </Link>
                    <IconChevronRight width={14} height={14} className="opacity-50" />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
      <JsonLd data={jsonLd} />
    </>
  );
}

export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is escaped for "<" so it cannot break out of the tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
  action,
  as: As = 'h2',
}: {
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  id?: string;
  action?: ReactNode;
  as?: 'h1' | 'h2';
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
        <As id={id} className="text-[2rem] font-bold uppercase sm:text-[2.5rem]">
          {title}
        </As>
        {intro ? <div className="mt-3 text-stone-600">{intro}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  actions,
  tone = 'light',
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  tone?: 'light' | 'dark';
}) {
  return (
    <div
      className={`rounded-[var(--radius-plate)] border border-dashed px-5 py-10 text-center sm:px-10 ${
        tone === 'dark' ? 'border-ivory-50/20 text-ivory-100' : 'border-graphite-900/20 bg-ivory-100/60'
      }`}
    >
      {icon ? (
        <div
          className={`mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full ${
            tone === 'dark' ? 'bg-white/5 text-bronze-300' : 'bg-ivory-200 text-bronze-700'
          }`}
        >
          {icon}
        </div>
      ) : null}
      <h3 className={`text-xl font-semibold uppercase ${tone === 'dark' ? 'text-ivory-50' : ''}`}>{title}</h3>
      {children ? (
        <div className={`mx-auto mt-2 max-w-md text-[0.9375rem] ${tone === 'dark' ? 'text-ivory-200/80' : 'text-stone-600'}`}>
          {children}
        </div>
      ) : null}
      {actions ? <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </div>
  );
}
