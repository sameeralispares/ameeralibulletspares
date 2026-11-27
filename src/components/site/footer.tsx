import Link from 'next/link';
import { getBusinessSettings, getModels } from '@/lib/data/catalog';
import { mapsUrl, telHref } from '@/lib/contact';
import { LogoBadge } from './brand';
import { NAV_ITEMS } from './header';
import { IconClock, IconMapPin, IconPhone } from '@/components/ui/icons';

export async function SiteFooter() {
  const [settings, models] = await Promise.all([getBusinessSettings(), getModels()]);
  const tel = telHref(settings.landline);
  const directions = mapsUrl({ verifiedUrl: settings.google_maps_url, name: settings.business_name, address: settings.address });
  const socials = [
    { href: settings.facebook_url, label: 'Facebook' },
    { href: settings.instagram_url, label: 'Instagram' },
    { href: settings.youtube_url, label: 'YouTube' },
  ].filter((s): s is { href: string; label: string } => Boolean(s.href));

  return (
    <footer className="bg-blueprint text-ivory-100">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-4">
              <LogoBadge sizes="96px" className="h-24 w-auto" />
              <div className="leading-tight">
                <p className="font-display text-2xl font-bold uppercase tracking-[0.05em] text-ivory-50">S Ameer Ali</p>
                <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-bronze-300">Bullet Spare Parts · Chennai</p>
              </div>
            </div>
            <p className="mt-5 max-w-sm text-[0.9375rem] text-ivory-200/80">
              Genuine Royal Enfield spare parts from our shop in Venkatachalan Naicken Street, Pudupet, Chennai.
            </p>
            <address className="mt-6 space-y-3 not-italic text-[0.9375rem]">
              {settings.address && (
                <p className="flex gap-3">
                  <IconMapPin className="mt-0.5 shrink-0 text-bronze-400" />
                  <span>{settings.address}</span>
                </p>
              )}
              {tel && (
                <p className="flex gap-3">
                  <IconPhone className="mt-0.5 shrink-0 text-bronze-400" />
                  <a href={tel} className="-my-2.5 inline-flex min-h-11 items-center underline-offset-4 hover:text-bronze-300 hover:underline">
                    {settings.landline}
                  </a>
                </p>
              )}
              {settings.opening_hours && (
                <p className="flex gap-3">
                  <IconClock className="mt-0.5 shrink-0 text-bronze-400" />
                  <span className="whitespace-pre-line">{settings.opening_hours}</span>
                </p>
              )}
            </address>
            {directions && (
              <a
                href={directions}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-bronze-300 hover:text-bronze-200"
              >
                Get directions →
              </a>
            )}
          </div>

          <nav aria-label="Footer — models" className="md:col-span-4">
            <h2 className="eyebrow-dark mb-4">Parts by model</h2>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.9375rem]">
              {models.map((m) => (
                <li key={m.id}>
                  <Link href={`/models/${m.slug}`} className="inline-flex min-h-10 items-center text-ivory-200/85 hover:text-bronze-300">
                    {m.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav id="footer-site-nav" aria-label="Footer — site" className="md:col-span-3">
            <h2 className="eyebrow-dark mb-4">Shop</h2>
            <ul className="space-y-1 text-[0.9375rem]">
              <li>
                <Link href="/" className="inline-flex min-h-10 items-center text-ivory-200/85 hover:text-bronze-300">
                  Home
                </Link>
              </li>
              {NAV_ITEMS.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="inline-flex min-h-10 items-center text-ivory-200/85 hover:text-bronze-300">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
            {socials.length > 0 && (
              <>
                <h2 className="eyebrow-dark mb-3 mt-8">Follow</h2>
                <ul className="flex flex-wrap gap-x-4">
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a href={s.href} target="_blank" rel="noopener noreferrer me" className="inline-flex min-h-10 items-center text-ivory-200/85 hover:text-bronze-300">
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </nav>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-ivory-200/60">
          <p>
            © {settings.business_name}. Royal Enfield and its model names are trademarks of their respective owner and are
            used on this website only to describe the motorcycles our parts fit.
          </p>
          <p className="mt-2">
            Website by Sam Tech Builds.
          </p>
        </div>
      </div>
    </footer>
  );
}
