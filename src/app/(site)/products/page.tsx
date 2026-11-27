import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Breadcrumbs, Container } from '@/components/ui/primitives';
import { CatalogResults, CatalogSkeleton } from '@/components/catalog/catalog-results';
import { CantFindPart } from '@/components/catalog/cant-find-part';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'All Genuine Royal Enfield Spare Parts',
  description:
    'Search genuine Royal Enfield spare parts at S Ameer Ali, Pudupet, Chennai. Filter by motorcycle model, part category and availability, then enquire before you visit.',
  path: '/products',
});

export default function ProductsPage(props: PageProps<'/products'>) {
  return (
    <>
      <section className="border-b border-graphite-900/10 bg-ivory-100">
        <Container className="pb-8 pt-6 sm:pb-10">
          <Breadcrumbs items={[{ name: 'All parts', href: '/products' }]} />
          <p className="eyebrow mb-2 mt-6">Catalogue</p>
          <h1 className="text-[2.25rem] font-bold uppercase sm:text-[3rem]">Genuine spare parts</h1>
          <p className="mt-3 max-w-2xl text-stone-600">
            Search by part name or part number, or narrow down by motorcycle model and category. Availability is updated
            by the shop.
          </p>
        </Container>
      </section>
      <Container className="py-8 sm:py-10">
        <Suspense fallback={<CatalogSkeleton />}>
          <CatalogResults searchParams={props.searchParams} basePath="/products" />
        </Suspense>
        <Suspense fallback={null}>
          <CantFindPart />
        </Suspense>
      </Container>
    </>
  );
}
