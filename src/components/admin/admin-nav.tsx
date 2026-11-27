'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { IconDashboard, IconBox, IconMotorcycle, IconTag, IconSettings } from '@/components/ui/icons';

const ITEMS = [
  { href: '/admin', label: 'Dashboard', short: 'Home', Icon: IconDashboard },
  { href: '/admin/products', label: 'Products', short: 'Products', Icon: IconBox },
  { href: '/admin/models', label: 'Models', short: 'Models', Icon: IconMotorcycle },
  { href: '/admin/categories', label: 'Categories', short: 'Categories', Icon: IconTag },
  { href: '/admin/settings', label: 'Business details', short: 'Settings', Icon: IconSettings },
];

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

export function AdminSideNav() {
  return <SideNavList pathname={usePathname()} />;
}

/** Rendered without an active item while the current path streams in. */
export function SideNavList({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Admin" className="hidden lg:block">
      <ul className="space-y-1">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-medium ${
                  active ? 'bg-graphite-900 text-ivory-50' : 'text-graphite-800 hover:bg-ivory-200/70'
                }`}
              >
                <Icon className={active ? 'text-bronze-300' : 'text-stone-500'} /> {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Thumb-reachable bottom navigation for the owner's phone. */
export function AdminBottomNav() {
  return <BottomNavList pathname={usePathname()} />;
}

export function BottomNavList({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Admin"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-graphite-900/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map(({ href, short, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold ${
                  active ? 'text-ink' : 'text-stone-500'
                }`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? 'bg-bronze-300/60' : ''}`}>
                  <Icon width={20} height={20} />
                </span>
                {short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
