import { Breadcrumbs, Container } from '@/components/ui/primitives';
import { BulletGearLoader } from '@/components/ui/bullet-loader';

/**
 * Shown instantly while the models page loads, so tapping "Shop by model"
 * gives immediate feedback instead of a blank wait. Mirrors the real header.
 */
export default function ModelsLoading() {
  return (
    <section className="bg-blueprint text-ivory-50">
      <Container className="pb-12 pt-6 sm:pb-16">
        <Breadcrumbs items={[{ name: 'Models', href: '/models' }]} tone="dark" />
        <p className="eyebrow-dark mb-2 mt-8">Shop by model</p>
        <h1 className="text-[2.5rem] font-bold uppercase text-ivory-50 sm:text-[3.5rem]">
          Which Royal Enfield do you ride?
        </h1>
        <p className="mt-4 max-w-2xl text-ivory-200/85">
          Choose your motorcycle to see the genuine parts listed for it.
        </p>
        <div className="mt-10">
          <BulletGearLoader label="Loading models…" tone="dark" />
        </div>
        <div aria-hidden="true" className="mt-8 grid animate-pulse grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-[var(--radius-plate)] bg-ivory-50/10 sm:h-64" />
          ))}
        </div>
      </Container>
    </section>
  );
}
