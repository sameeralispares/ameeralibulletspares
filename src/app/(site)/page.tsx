import { ShopImage } from '@/components/shop-image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { Container, EmptyState, JsonLd, SectionHeading } from '@/components/ui/primitives';
import { IconArrowRight, IconBox, IconMapPin, IconMotorcycle, IconPhone, IconSearch, IconShield } from '@/components/ui/icons';
import { ModelGrid } from '@/components/catalog/model-card';
import { ProductGrid } from '@/components/catalog/product-card';
import { EnquiryActions, hasWhatsApp } from '@/components/site/enquiry';
import { LogoBadge } from '@/components/site/brand';
import { VisitSection } from '@/components/site/visit-section';
import {
  getBusinessSettings,
  getCategoriesInUse,
  getModelsWithCounts,
  searchCatalog,
} from '@/lib/data/catalog';
import { localBusinessJsonLd, pageMetadata } from '@/lib/seo';
import { telHref } from '@/lib/contact';
import { activeFestiveOffer, festiveDiscountText } from '@/lib/pricing';
import { brandImageUrl } from '@/lib/supabase/env';

export const metadata: Metadata = pageMetadata({
  title: 'Genuine Royal Enfield Spare Parts in Chennai | S Ameer Ali, Pudupet',
  description:
    'Genuine Royal Enfield spare parts in Pudupet, Chennai. Browse parts for Bullet, Classic, Electra, Thunderbird, Hunter 350, Meteor 350, Himalayan and 650 twins, then call or message to check availability.',
  path: '/',
  absoluteTitle: true,
});

export default async function HomePage() {
  const [settings, models, categories, featured] = await Promise.all([
    getBusinessSettings(),
    getModelsWithCounts(),
    getCategoriesInUse(),
    searchCatalog({ featured: true, pageSize: 8 }),
  ]);
  // Fall back to the newest published parts when nothing is marked featured.
  const showcase = featured.items.length ? featured : await searchCatalog({ pageSize: 8 });
  const tel = telHref(settings.landline);
  const festive = activeFestiveOffer(settings);
  const heroImage = settings.hero_image_path ? brandImageUrl(settings.hero_image_path) : null;

  return (
    <>
      <JsonLd data={localBusinessJsonLd(settings)} />

      {festive && (
        <div role="status" className="bg-bronze-500 text-ink">
          <Container className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-sm font-semibold">
            <span className="font-display uppercase tracking-[0.12em]">{settings.festive_label || 'Festive offer'}</span>
            <span>{festiveDiscountText(festive)} on parts with a listed MRP</span>
          </Container>
        </div>
      )}

      {/* ------------------------------------------------------------ Hero */}
      <section className="bg-blueprint relative overflow-hidden text-ivory-50">
        <Container className="relative grid items-center gap-8 pb-12 pt-10 sm:pb-16 sm:pt-14 lg:grid-cols-12 lg:gap-6 lg:pb-20 lg:pt-20">
          <div className="lg:col-span-7">
            <LogoBadge priority sizes="112px" className="mb-6 h-28 w-auto drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)] sm:hidden" />
            <p className="eyebrow-dark flex items-center gap-2">
              <IconMapPin width={16} height={16} /> Venkatachalan Naicken Street · Pudupet · Chennai
            </p>
            <h1 className="mt-4 text-[2.75rem] font-bold uppercase leading-[0.95] text-ivory-50 min-[400px]:text-[3.25rem] sm:text-[4.25rem] lg:text-[4.75rem]">
              Genuine Royal&nbsp;Enfield <span className="text-bronze-400">spare parts</span>
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-ivory-200/85 sm:text-lg">
              Parts for Bullet, Classic, Electra, Thunderbird and newer Royal Enfield models — from our shop in Pudupet,
              Chennai. Find your part online, then check availability with us before you visit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ButtonLink href="/models" size="lg" className="w-full sm:w-auto">
                <IconMotorcycle width={22} height={22} /> Shop by model
              </ButtonLink>
              <EnquiryActions settings={settings} size="lg" tone="dark" showCall={false} fullWidth />
            </div>
            {tel && hasWhatsApp(settings) && (
              <p className="mt-6 text-sm text-ivory-200/70">
                Or call the shop:{' '}
                <a href={tel} className="font-semibold text-ivory-50 underline decoration-bronze-500 underline-offset-4">
                  {settings.landline}
                </a>
              </p>
            )}
          </div>
          <div className="relative hidden sm:flex sm:justify-center lg:col-span-5">
            <div aria-hidden="true" className="absolute inset-0 m-auto h-72 w-72 rounded-full bg-bronze-500/15 blur-3xl" />
            {heroImage ? (
              <ShopImage
                src={heroImage}
                alt={settings.business_name}
                width={760}
                height={760}
                priority
                sizes="(min-width: 1024px) 380px, 300px"
                className="relative h-auto w-[300px] object-contain drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)] lg:w-[380px]"
              />
            ) : (
              <LogoBadge priority sizes="(min-width: 1024px) 380px, 300px" className="relative h-auto w-[300px] drop-shadow-[0_18px_40px_rgba(0,0,0,0.6)] lg:w-[380px]" />
            )}
          </div>
        </Container>
        <div className="border-t border-white/10 bg-graphite-950/80">
          <Container>
            <ul className="grid grid-cols-1 divide-y divide-white/10 text-sm text-ivory-200/85 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <li className="flex items-center gap-3 py-3.5 sm:px-5 sm:first:pl-0">
                <IconShield className="shrink-0 text-bronze-400" /> Genuine Royal Enfield parts only
              </li>
              <li className="flex items-center gap-3 py-3.5 sm:px-5">
                <IconSearch className="shrink-0 text-bronze-400" /> Search by model or part number
              </li>
              <li className="flex items-center gap-3 py-3.5 sm:px-5">
                <IconPhone className="shrink-0 text-bronze-400" /> Confirm stock before you travel
              </li>
            </ul>
          </Container>
        </div>
      </section>

      {/* ------------------------------------------------- Browse by model */}
      <section aria-labelledby="models-heading" className="py-14 sm:py-20">
        <Container>
          <SectionHeading
            id="models-heading"
            eyebrow="Step 1"
            title="Choose your motorcycle"
            intro="Pick your Royal Enfield to see the genuine parts we list for it."
            action={
              <Link href="/models" className="inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-bronze-700 hover:text-ink">
                All models <IconArrowRight width={16} height={16} />
              </Link>
            }
          />
          <div className="mt-8">
            {models.length ? (
              <ModelGrid models={models} />
            ) : (
              <EmptyState icon={<IconMotorcycle />} title="Models are being set up">
                Please call the shop to ask about parts for your motorcycle.
              </EmptyState>
            )}
          </div>
        </Container>
      </section>

      {/* -------------------------------------- Intro + genuine parts message */}
      <section aria-labelledby="intro-heading" className="border-y border-graphite-900/10 bg-white py-14 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-2">S Ameer Ali, Pudupet</p>
            <h2 id="intro-heading" className="text-[2rem] font-bold uppercase sm:text-[2.5rem]">
              A Royal Enfield spare parts shop in Chennai
            </h2>
          </div>
          <div className="space-y-5 text-[1.0625rem] leading-relaxed text-stone-600 lg:col-span-7">
            <p>
              S Ameer Ali Bullet Spare Parts is located in Venkatachalan Naicken Street, Pudupet — near Egmore in central Chennai. We
              stock <strong className="font-semibold text-ink">genuine Royal Enfield spare parts only</strong>. We do
              not sell aftermarket or duplicate parts.
            </p>
            <div className="rule-machined my-2" />
            <ul className="grid gap-4 sm:grid-cols-2">
              <li className="flex gap-3">
                <IconShield className="mt-1 shrink-0 text-bronze-600" />
                <span>
                  <span className="block font-semibold text-ink">Genuine parts only</span>
                  No duplicates, no copies.
                </span>
              </li>
              <li className="flex gap-3">
                <IconMotorcycle className="mt-1 shrink-0 text-bronze-600" />
                <span>
                  <span className="block font-semibold text-ink">Listed by model</span>
                  Each part shows the motorcycles it fits.
                </span>
              </li>
            </ul>
          </div>
        </Container>
      </section>

      {/* ----------------------------------------------- Browse by category */}
      <section aria-labelledby="categories-heading" className="py-14 sm:py-20">
        <Container>
          <SectionHeading id="categories-heading" eyebrow="Browse" title="Parts by category" />
          <div className="mt-8">
            {categories.length ? (
              <ul className="flex flex-wrap gap-2.5">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/products?category=${c.slug}`}
                      className="inline-flex min-h-12 items-center gap-3 rounded-full border border-graphite-900/15 bg-white px-5 font-medium hover:border-bronze-500 hover:bg-ivory-100"
                    >
                      {c.name}
                      <span className="rounded-full bg-ivory-200 px-2 py-0.5 font-mono text-xs text-stone-600">{c.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<IconBox />} title="Categories will appear as parts are listed">
                Our online catalogue is being built. Ask us directly about the part you need.
              </EmptyState>
            )}
          </div>
        </Container>
      </section>

      {/* ------------------------------------------------ Featured products */}
      <section aria-labelledby="featured-heading" className="bg-ivory-100 py-14 sm:py-20">
        <Container>
          <SectionHeading
            id="featured-heading"
            eyebrow={featured.items.length ? 'Featured' : 'Latest'}
            title={featured.items.length ? 'Featured parts' : 'Recently listed parts'}
            action={
              showcase.items.length ? (
                <Link href="/products" className="inline-flex min-h-11 items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.12em] text-bronze-700 hover:text-ink">
                  View all parts <IconArrowRight width={16} height={16} />
                </Link>
              ) : undefined
            }
          />
          <div className="mt-8">
            {showcase.items.length ? (
              <ProductGrid items={showcase.items} />
            ) : (
              <EmptyState
                icon={<IconBox />}
                title="Parts are being added"
                actions={<EnquiryActions settings={settings} context={{}} />}
              >
                We are photographing and listing our genuine parts. Until then, tell us your model and the part you
                need and we&apos;ll check for you.
              </EmptyState>
            )}
          </div>
        </Container>
      </section>

      {/* -------------------------------------------------- Why choose */}
      <section aria-labelledby="why-heading" className="py-14 sm:py-20">
        <Container>
          <SectionHeading id="why-heading" eyebrow="Why S Ameer Ali" title="Buying parts made simple" />
          <ol className="mt-10 grid gap-px overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/10 bg-graphite-900/10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Genuine only', d: 'We stock genuine Royal Enfield spare parts — no aftermarket or duplicate parts.' },
              { t: 'Find it by model', d: 'Browse by your motorcycle or search by part name and part number.' },
              { t: 'Check before you travel', d: 'Ask us to confirm availability by phone before you come to the shop.' },
              { t: 'Central Chennai', d: 'Venkatachalan Naicken Street, Pudupet — close to Egmore.' },
            ].map((f, i) => (
              <li key={f.t} className="bg-white p-6">
                <span className="font-mono text-xs text-bronze-700">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 text-xl font-bold uppercase">{f.t}</h3>
                <p className="mt-2 text-[0.9375rem] text-stone-600">{f.d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <VisitSection settings={settings} />
    </>
  );
}
