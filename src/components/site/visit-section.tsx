import { ButtonAnchor } from '@/components/ui/button';
import { IconClock, IconMapPin, IconPhone } from '@/components/ui/icons';
import { Container } from '@/components/ui/primitives';
import { mapsUrl, telHref } from '@/lib/contact';
import type { BusinessSettings } from '@/lib/types';
import { EnquiryActions } from './enquiry';

/** Shop location + contact block (homepage and contact page). */
export function VisitSection({
  settings,
  headingLevel = 'h2',
  title = 'Venkatachalan Naicken Street, Pudupet',
  eyebrow = 'Visit the shop',
}: {
  settings: BusinessSettings;
  headingLevel?: 'h1' | 'h2';
  title?: string;
  eyebrow?: string;
}) {
  const H = headingLevel;
  const tel = telHref(settings.landline);
  const directions = mapsUrl({ verifiedUrl: settings.google_maps_url, name: settings.business_name, address: settings.address });

  return (
    <section aria-labelledby="visit-heading" className="bg-ivory-100 py-16 sm:py-20">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-2">{eyebrow}</p>
            <H id="visit-heading" className="text-[2rem] font-bold uppercase sm:text-[2.5rem]">
              {title}
            </H>
            <p className="mt-4 text-stone-600">
              Call before you travel and we&apos;ll check whether the part for your motorcycle is in stock.
            </p>
            <EnquiryActions settings={settings} className="mt-7" fullWidth />
          </div>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/12 bg-white shadow-[var(--shadow-plate)]">
              <dl className="divide-y divide-graphite-900/10">
                <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 p-5 sm:p-6">
                  <IconMapPin className="row-span-2 mt-1 text-bronze-600" width={22} height={22} />
                    <dt className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Address</dt>
                    <dd className="mt-1 text-[1.0625rem] leading-relaxed">
                      <span className="font-semibold">{settings.business_name}</span>
                      <br />
                      {settings.address}
                    </dd>
                </div>
                {tel && (
                  <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 p-5 sm:p-6">
                    <IconPhone className="row-span-2 mt-1 text-bronze-600" width={22} height={22} />
                      <dt className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Phone</dt>
                      <dd className="mt-1 text-[1.0625rem]">
                        <a href={tel} className="font-semibold underline decoration-bronze-500/60 underline-offset-4 hover:decoration-bronze-600">
                          {settings.landline}
                        </a>
                      </dd>
                  </div>
                )}
                <div className="grid grid-cols-[auto_1fr] items-start gap-x-4 p-5 sm:p-6">
                  <IconClock className="row-span-2 mt-1 text-bronze-600" width={22} height={22} />
                    <dt className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Opening hours</dt>
                    <dd className="mt-1 whitespace-pre-line text-[1.0625rem]">
                      {settings.opening_hours ?? 'Please call the shop to confirm opening hours before visiting.'}
                    </dd>
                </div>
              </dl>
              {directions && (
                <div className="border-t border-graphite-900/10 bg-ivory-50 p-4 sm:p-5">
                  <ButtonAnchor href={directions} target="_blank" rel="noopener noreferrer" variant="dark" className="w-full sm:w-auto">
                    <IconMapPin /> Get directions in Google Maps
                  </ButtonAnchor>
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
