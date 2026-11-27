'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { IconClose, IconMenu, IconPhone, IconSearch } from '@/components/ui/icons';

type NavItem = { href: string; label: string };

export function MobileMenu({ items, phoneHref, phoneLabel }: { items: NavItem[]; phoneHref: string | null; phoneLabel: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close when navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('input, a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (e.key === 'Tab' && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>('a, button, input');
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          (buttonRef.current ?? last).focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          buttonRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="grid h-11 w-11 place-items-center rounded-md text-ivory-50 hover:bg-white/10"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <IconClose width={24} height={24} /> : <IconMenu width={24} height={24} />}
      </button>

      {open && (
        <div
          id={panelId}
          ref={panelRef}
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-white/10 bg-graphite-950 animate-fade-in"
        >
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-5">
            <form action="/products" method="get" role="search" className="relative">
              <label htmlFor={`${panelId}-q`} className="sr-only">
                Search spare parts
              </label>
              <input
                id={`${panelId}-q`}
                name="q"
                type="search"
                enterKeyHint="search"
                placeholder="Search parts or part number"
                className="h-12 w-full rounded-md border border-white/15 bg-graphite-900 pl-11 pr-3 text-ivory-50 placeholder:text-ivory-200/50 focus:border-bronze-400 focus:outline-none"
              />
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ivory-200/60" />
            </form>
            <nav aria-label="Mobile" className="mt-4">
              <ul className="divide-y divide-white/10 border-y border-white/10">
                {items.map((item) => {
                  const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`flex min-h-14 items-center justify-between font-display text-xl font-semibold uppercase tracking-[0.08em] ${
                          active ? 'text-bronze-300' : 'text-ivory-50'
                        }`}
                      >
                        {item.label}
                        <span aria-hidden="true" className="text-bronze-400">
                          →
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
            {phoneHref && (
              <a
                href={phoneHref}
                className="mt-6 flex min-h-14 items-center justify-center gap-2 rounded-md bg-bronze-500 font-display text-lg font-semibold uppercase tracking-[0.08em] text-ink"
              >
                <IconPhone /> Call {phoneLabel}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
