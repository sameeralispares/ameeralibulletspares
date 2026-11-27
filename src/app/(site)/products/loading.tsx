import { Breadcrumbs, Container } from '@/components/ui/primitives';
import { BulletGearLoader } from '@/components/ui/bullet-loader';
import { CatalogSkeleton } from '@/components/catalog/catalog-results';

/**
 * Shown instantly while the catalogue page loads, so a tap gives immediate
 * feedback instead of a blank wait. Mirrors the real page header.
 */
export default function ProductsLoading() {
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
        <div className="mb-6">
          <BulletGearLoader label="Loading parts…" />
        </div>
        <CatalogSkeleton />
      </Container>
    </>
  );
}
