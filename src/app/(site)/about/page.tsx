import type { Metadata } from 'next';
import { Breadcrumbs, Container } from '@/components/ui/primitives';
import { IconMapPin, IconMotorcycle, IconShield } from '@/components/ui/icons';
import { ButtonLink } from '@/components/ui/button';
import { EnquiryActions } from '@/components/site/enquiry';
import { getBusinessSettings } from '@/lib/data/catalog';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About S Ameer Ali Bullet Spare Parts, Pudupet',
  description:
    'S Ameer Ali Bullet Spare Parts is a Royal Enfield spare parts shop in Venkatachalan Naicken Street, Pudupet, Chennai, selling genuine Royal Enfield parts only.',
  path: '/about',
});

export default async function AboutPage() {
  const settings = await getBusinessSettings();
  return (
    <>
      <section className="bg-blueprint text-ivory-50">
        <Container className="pb-12 pt-6 sm:pb-16">
          <Breadcrumbs items={[{ name: 'About', href: '/about' }]} tone="dark" />
          <p className="eyebrow-dark mb-2 mt-8">About the shop</p>
          <h1 className="max-w-3xl text-[2.5rem] font-bold uppercase text-ivory-50 sm:text-[3.5rem]">{settings.business_name}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ivory-200/85">
            A Royal Enfield spare parts shop in Venkatachalan Naicken Street, Pudupet, Chennai — genuine parts only.
          </p>
        </Container>
      </section>

      <Container className="py-14 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-7">
            {/* Owner-supplied text only. Nothing here is invented. */}
            <section aria-labelledby="intro-h">
              <h2 id="intro-h" className="text-[1.75rem] font-bold uppercase">Who we are</h2>
              <div className="prose-shop mt-4 text-[1.0625rem] leading-relaxed text-graphite-800">
                {settings.about_intro ??
                  `${settings.business_name} sells genuine Royal Enfield spare parts from our shop in Venkatachalan Naicken Street, Pudupet, near Egmore in Chennai. We do not sell aftermarket or duplicate parts.`}
              </div>
            </section>

            {settings.about_history && (
              <section aria-labelledby="history-h">
                <h2 id="history-h" className="text-[1.75rem] font-bold uppercase">Our story</h2>
                <div className="prose-shop mt-4 text-[1.0625rem] leading-relaxed text-graphite-800">{settings.about_history}</div>
              </section>
            )}

            <section aria-labelledby="how-h">
              <h2 id="how-h" className="text-[1.75rem] font-bold uppercase">How to buy from us</h2>
              <ol className="mt-5 space-y-4">
                {[
                  'Find your motorcycle model or search for the part on this website.',
                  'Check the part’s compatibility and current availability.',
                  'Call or message the shop to confirm before you visit.',
                ].map((step, i) => (
                  <li key={step} className="flex gap-4">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-bronze-500 font-mono text-sm text-bronze-700">
                      {i + 1}
                    </span>
                    <span className="pt-1 text-[1.0625rem]">{step}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/models" variant="dark">
                  <IconMotorcycle /> Shop by model
                </ButtonLink>
                <EnquiryActions settings={settings} showCall={false} />
              </div>
            </section>
          </div>

          <aside className="lg:col-span-5">
            <div className="space-y-px overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/10 bg-graphite-900/10">
              <div className="flex gap-4 bg-white p-6">
                <IconShield className="mt-1 shrink-0 text-bronze-600" width={24} height={24} />
                <div>
                  <h3 className="text-lg font-bold uppercase">Genuine parts only</h3>
                  <p className="mt-1 text-[0.9375rem] text-stone-600">
                    We stock genuine Royal Enfield spare parts. No aftermarket or duplicate parts.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 bg-white p-6">
                <IconMapPin className="mt-1 shrink-0 text-bronze-600" width={24} height={24} />
                <div>
                  <h3 className="text-lg font-bold uppercase">Find us</h3>
                  <p className="mt-1 text-[0.9375rem] text-stone-600">{settings.address}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
