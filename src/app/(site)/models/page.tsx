import type { Metadata } from 'next';
import { Breadcrumbs, Container, EmptyState } from '@/components/ui/primitives';
import { IconMotorcycle } from '@/components/ui/icons';
import { ModelGrid } from '@/components/catalog/model-card';
import { getModelsWithCounts } from '@/lib/data/catalog';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Royal Enfield Spare Parts by Model',
  description:
    'Genuine spare parts for Royal Enfield Bullet, Classic, Electra, Thunderbird, Standard, Meteor 350, Hunter 350, Himalayan, Scram, Interceptor 650 and Continental GT 650 — S Ameer Ali, Chennai.',
  path: '/models',
});

export default async function ModelsPage() {
  const models = await getModelsWithCounts();
  return (
    <>
      <section className="bg-blueprint text-ivory-50">
        <Container className="pb-12 pt-6 sm:pb-16">
          <Breadcrumbs items={[{ name: 'Models', href: '/models' }]} tone="dark" />
          <p className="eyebrow-dark mb-2 mt-8">Shop by model</p>
          <h1 className="text-[2.5rem] font-bold uppercase text-ivory-50 sm:text-[3.5rem]">Which Royal Enfield do you ride?</h1>
          <p className="mt-4 max-w-2xl text-ivory-200/85">
            Choose your motorcycle to see the genuine parts listed for it. Don&apos;t see your model? Try{' '}
            <span className="text-ivory-50">Other / Newer Models</span> or ask us directly.
          </p>
          <div className="mt-10">
            {models.length ? (
              <ModelGrid models={models} tone="dark" />
            ) : (
              <EmptyState icon={<IconMotorcycle />} title="Models are being set up" tone="dark">
                Please call the shop to ask about parts for your motorcycle.
              </EmptyState>
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
