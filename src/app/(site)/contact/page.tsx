import type { Metadata } from 'next';
import { Breadcrumbs, Container, JsonLd } from '@/components/ui/primitives';
import { VisitSection } from '@/components/site/visit-section';
import { getBusinessSettings } from '@/lib/data/catalog';
import { localBusinessJsonLd, pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Contact & Directions — Royal Enfield Parts Shop near Egmore',
  description:
    'Contact S Ameer Ali Bullet Spare Parts: 25, Venkatachalan Naicken Street, Pudupet, Chennai-02. Phone +91 96770 93315.',
  path: '/contact',
});

export default async function ContactPage() {
  const settings = await getBusinessSettings();
  return (
    <>
      <JsonLd data={localBusinessJsonLd(settings)} />
      <div className="border-b border-graphite-900/10 bg-ivory-100">
        <Container className="pt-6">
          <Breadcrumbs items={[{ name: 'Contact', href: '/contact' }]} />
        </Container>
      </div>
      <VisitSection settings={settings} headingLevel="h1" eyebrow="Venkatachalan Naicken Street, Pudupet" title="Contact & directions" />
      {settings.email && (
        <Container className="py-10">
          <p className="text-stone-600">
            Email:{' '}
            <a className="font-semibold text-ink underline underline-offset-4" href={`mailto:${settings.email}`}>
              {settings.email}
            </a>
          </p>
        </Container>
      )}
    </>
  );
}
