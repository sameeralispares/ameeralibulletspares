import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Breadcrumbs, Container } from '@/components/ui/primitives';
import { CatalogResults, CatalogSkeleton } from '@/components/catalog/catalog-results';
import { getModelBySlug, getModels, getPublishedCounts } from '@/lib/data/catalog';
import { pageMetadata } from '@/lib/seo';

export async function generateStaticParams() {
  const models = await getModels();
  // At least one param is needed to prerender; unknown slugs render on demand.
  return models.length ? models.map((m) => ({ slug: m.slug })) : [{ slug: 'bullet' }];
}

export async function generateMetadata({ params }: PageProps<'/models/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) return { title: 'Model not found', robots: { index: false } };
  const counts = await getPublishedCounts();
  const count = counts.models[model.id]?.total ?? 0;
  const label = model.slug === 'other-newer-models' ? 'Newer Royal Enfield models' : `Royal Enfield ${model.name}`;
  return pageMetadata({
    title: `${label} Spare Parts in Chennai`,
    description: `Genuine ${label} spare parts at S Ameer Ali, Venkatachalan Naicken Street, Pudupet, Chennai. ${
      count ? `${count} ${count === 1 ? 'part' : 'parts'} listed online — ` : ''
    }call to check availability before you visit.`,
    path: `/models/${model.slug}`,
    // Avoid thin pages in Google: index a model page once it has real products.
    noindex: count === 0,
  });
}

async function ModelHeader({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) notFound();
  const isOther = model.slug === 'other-newer-models';
  return (
    <>
      <Breadcrumbs
        items={[
          { name: 'Models', href: '/models' },
          { name: model.name, href: `/models/${model.slug}` },
        ]}
        tone="dark"
      />
      <p className="eyebrow-dark mb-2 mt-8">Genuine Royal Enfield parts</p>
      <h1 className="text-[2.5rem] font-bold uppercase leading-none text-ivory-50 sm:text-[3.75rem]">
        {isOther ? 'Other & newer models' : `${model.name} spare parts`}
      </h1>
      <p className="mt-4 max-w-2xl text-ivory-200/85">
        {model.description ??
          (isOther
            ? 'Parts for Royal Enfield models not listed separately. Tell us your exact model and we’ll check for you.'
            : `Genuine spare parts for the Royal Enfield ${model.name}, from our shop in Pudupet, Chennai. Check compatibility on each part and confirm availability with us.`)}
      </p>
      <p className="mt-4 text-sm text-ivory-200/70">
        Looking for a different motorcycle?{' '}
        <Link href="/models" className="font-semibold text-bronze-300 underline underline-offset-4">
          See all models
        </Link>
      </p>
    </>
  );
}

async function ModelProducts({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const model = await getModelBySlug(slug);
  if (!model) notFound();
  return (
    <CatalogResults
      searchParams={searchParams}
      basePath={`/models/${model.slug}`}
      fixedModel={{ slug: model.slug, name: model.name }}
    />
  );
}

export default function ModelPage(props: PageProps<'/models/[slug]'>) {
  return (
    <>
      <section className="bg-blueprint text-ivory-50">
        <Container className="pb-10 pt-6 sm:pb-14">
          <Suspense
            fallback={
              <div aria-hidden="true" className="h-56 animate-pulse rounded bg-white/5" />
            }
          >
            <ModelHeader params={props.params} />
          </Suspense>
        </Container>
      </section>
      <Container className="py-8 sm:py-10">
        <Suspense fallback={<CatalogSkeleton />}>
          <ModelProducts params={props.params} searchParams={props.searchParams} />
        </Suspense>
      </Container>
    </>
  );
}
