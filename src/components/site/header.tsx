import Link from 'next/link';
import { Suspense } from 'react';
import { getBusinessSettings } from '@/lib/data/catalog';
import { buildEnquiryMessage, buildWhatsAppUrl, telHref } from '@/lib/contact';
import { BrandMark } from './brand';
import { MobileMenu } from './mobile-menu';
import { IconMenu, IconPhone, IconSearch, IconWhatsApp } from '@/components/ui/icons';
import { CartButton } from '@/components/cart/cart-button';

export const NAV_ITEMS = [
  { href: '/models', label: 'Shop by Model' },
  { href: '/products', label: 'All Parts' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export async function SiteHeader() {
  const settings = await getBusinessSettings();
  const tel = telHref(settings.landline);
  const whatsapp = buildWhatsAppUrl(settings.whatsapp_number, buildEnquiryMessage());

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-graphite-950">
      <a
        href="#main"
        className="sr-only z-[60] rounded bg-bronze-500 px-4 py-2 font-semibold text-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <BrandMark tone="dark" />

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-md px-3 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.1em] text-ivory-100 hover:bg-white/5 hover:text-bronze-300"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/products#catalogue-search"
            className="grid h-11 w-11 place-items-center rounded-md text-ivory-50 hover:bg-white/10"
            aria-label="Search parts"
          >
            <IconSearch width={22} height={22} />
          </Link>
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-11 w-11 place-items-center rounded-md text-[#25D366] hover:bg-white/10"
              aria-label="Chat with the shop on WhatsApp"
              title="Chat on WhatsApp"
            >
              <IconWhatsApp width={28} height={28} />
            </a>
          ) : (
            tel && (
              <a
                href={tel}
                className="hidden min-h-11 items-center gap-2 rounded-md border border-bronze-500/60 px-3.5 font-display text-[0.9375rem] font-semibold uppercase tracking-[0.08em] text-ivory-50 hover:bg-bronze-500 hover:text-ink sm:inline-flex"
              >
                <IconPhone width={18} height={18} />
                <span>{settings.landline}</span>
              </a>
            )
          )}
          <CartButton />
          <Suspense
            fallback={
              <a href="#footer-site-nav" className="grid h-11 w-11 place-items-center rounded-md text-ivory-50 lg:hidden" aria-label="Site menu">
                <IconMenu width={24} height={24} />
              </a>
            }
          >
            <MobileMenu items={NAV_ITEMS} phoneHref={tel} phoneLabel={settings.landline} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
