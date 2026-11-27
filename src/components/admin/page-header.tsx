import type { ReactNode } from 'react';

export function AdminPageHeader({ title, intro, action }: { title: string; intro?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[2rem] font-bold uppercase leading-none sm:text-[2.25rem]">{title}</h1>
        {intro ? <div className="mt-2 max-w-2xl text-[0.9375rem] text-stone-600">{intro}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white shadow-[var(--shadow-plate)] ${className}`}>
      {children}
    </div>
  );
}

const statusStyles: Record<string, string> = {
  published: 'bg-ok-50 text-ok-700 ring-ok-700/20',
  draft: 'bg-ivory-200 text-graphite-700 ring-graphite-900/10',
  hidden: 'bg-ask-50 text-ask-700 ring-ask-700/20',
  archived: 'bg-graphite-900/5 text-stone-600 ring-graphite-900/10',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[status] ?? ''}`}>
      {status}
    </span>
  );
}
