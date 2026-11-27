import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { AvailabilityBadge, Breadcrumbs, Container, JsonLd, SectionHeading } from '@/components/ui/primitives';
import { PartTypeBadge } from '@/components/catalog/part-type-tabs';
import { SUPPLY_BLURB } from '@/lib/part-types';
import { IconShield } from '@/components/ui/icons';
import { ProductGallery } from '@/components/catalog/product-gallery';
import { ProductEnquiry } from '@/components/catalog/product-enquiry';
import { PartTools } from '@/components/catalog/part-tools';
import { absoluteUrl } from '@/lib/site';
import { SupplyChoice } from '@/components/catalog/supply-choice';
import { PhotoPlaceholder, ProductGrid } from '@/components/catalog/product-card';
import {
  getBusinessSettings,
  getProductBySlug,
  getRelatedProducts,
  searchCatalog,
} from '@/lib/data/catalog';
import { resolveImageSrc } from '@/lib/image-source';
import { pageMetadata, productJsonLd } from '@/lib/seo';
import { normaliseWhatsAppNumber, telHref } from '@/lib/contact';
import { availabilityLabel } from '@/lib/types';

export async function generateStaticParams() {
  const { items } = await searchCatalog({ pageSize: 60 });
  // Prerender the newest published parts; the rest render on first visit.
  return items.length ? items.map((p) => ({ slug: p.slug })) : [{ slug: 'placeholder' }];
}

function describe(p: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>): string {
  if (p.seo_description) return p.seo_description;
  const fits = p.models.length ? ` for Royal Enfield ${p.models.map((m) => m.name).join(', ')}` : '';
  const part = p.part_number ? ` (part no. ${p.part_number})` : '';
  return `Genuine ${p.name}${part}${fits} at S Ameer Ali, Pudupet, Chennai. ${availabilityLabel(
    p.availability,
  )} — enquire before you visit.`.slice(0, 165);
}

export async function generateMetadata({ params }: PageProps<'/products/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: 'Part not found', robots: { index: false } };
  const firstImage = resolveImageSrc(p.images[0]);
  return pageMetadata({
    title: p.seo_title || `${p.name}${p.models.length === 1 ? ` – ${p.models[0].name}` : ''} | Genuine RE Part`,
    description: describe(p),
    path: `/products/${p.slug}`,
    images: firstImage ? [firstImage] : undefined,
  });
}

async function ProductContent({ params }: { params: Promise<{ slug: string }> }) {
  // Render per request from the (tag-invalidated) data cache, so archiving or
  // hiding a part takes effect immediately instead of serving a stale page.
  await connection();
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getBusinessSettings()]);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const gallery = product.images
    .map((img, i) => {
      const src = resolveImageSrc(img);
      return src
        ? { src, alt: img.alt_text || `${product.name}${i ? ` — photo ${i + 1}` : ''}` }
        : null;
    })
    .filter((g): g is { src: string; alt: string } => g !== null);

  const enquiryProps = {
    whatsappNumber: normaliseWhatsAppNumber(settings.whatsapp_number),
    landline: settings.landline,
    telHref: telHref(settings.landline),
    productName: product.name,
    partNumber: product.part_number,
    models: product.models.map((m) => ({ slug: m.slug, name: m.name })),
  };

  const crumbs = [
    { name: 'All parts', href: '/products' },
    ...(product.category ? [{ name: product.category.name, href: `/products?category=${product.category.slug}` }] : []),
    { name: product.name, href: `/products/${product.slug}` },
  ];

  return (
    <>
      <JsonLd data={productJsonLd(product, settings)} />
      <Container className="pb-28 pt-6 lg:pb-16">
        <Breadcrumbs items={crumbs} />

        <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            {gallery.length ? (
              <ProductGallery images={gallery} />
            ) : (
              <div className="aspect-square overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/10 sm:aspect-[4/3.4]">
                <PhotoPlaceholder label="Photo coming soon — ask us for one" />
              </div>
            )}
          </div>

          <div className="lg:col-span-5">
            {product.category && (
              <Link
                href={`/products?category=${product.category.slug}`}
                className="eyebrow inline-flex min-h-11 items-center hover:text-ink"
              >
                {product.category.name}
              </Link>
            )}
            <h1 className="mt-1 font-display text-[2rem] font-bold uppercase leading-[1.02] sm:text-[2.5rem]">{product.name}</h1>
            {product.part_number && (
              <p className="mt-3 font-mono text-sm text-stone-600">
                Part no. <span className="text-ink">{product.part_number}</span>
              </p>
            )}

            <SupplyChoice
              product={{
                id: product.id,
                slug: product.slug,
                name: product.name,
                part_number: product.part_number,
                part_type: product.part_type,
              }}
              prices={product.supplyPricing}
            />

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <AvailabilityBadge value={product.availability} size="md" />
              {/* Every part is genuine; the badge says which supply it came from. */}
              <span className="inline-flex items-center gap-1.5 text-sm text-stone-600">
                <IconShield width={18} height={18} className="text-bronze-600" /> Genuine Royal Enfield part
              </span>
              <PartTypeBadge type={product.part_type} />
            </div>
            {product.part_type === 'vendor' && (
              <p className="mt-2 text-sm text-stone-600">{SUPPLY_BLURB.vendor}</p>
            )}

            <div className="mt-7">
              <h2 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Fits these motorcycles</h2>
              {product.models.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {product.models.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/models/${m.slug}`}
                        className="inline-flex min-h-10 items-center rounded-md border border-graphite-900/15 bg-white px-3 text-sm font-medium hover:border-bronze-500"
                      >
                        {m.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-stone-600">Compatibility not listed yet — ask us to confirm for your motorcycle.</p>
              )}
            </div>

            <div className="mt-5">
              <ProductEnquiry {...enquiryProps} />
              <PartTools productName={product.name} partNumber={product.part_number} url={absoluteUrl(`/products/${product.slug}`)} />
            </div>

            {product.description && (
              <div className="mt-8 border-t border-graphite-900/10 pt-6">
                <h2 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Description</h2>
                <div className="prose-shop mt-3 text-[1.0625rem] leading-relaxed text-graphite-800">{product.description}</div>
              </div>
            )}
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="related-heading" className="mt-16 border-t border-graphite-900/10 pt-12">
            <SectionHeading id="related-heading" eyebrow="You may also need" title="Related parts" />
            <div className="mt-8">
              <ProductGrid items={related} />
            </div>
          </section>
        )}
      </Container>

      {/* Mobile: enquiry always within thumb reach */}
      <div data-sticky-enquiry className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-graphite-950/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <ProductEnquiry {...enquiryProps} variant="bar" />
      </div>
    </>
  );
}

export default function ProductPage(props: PageProps<'/products/[slug]'>) {
  return (
    <Suspense
      fallback={
        <Container className="pt-6">
          <div aria-hidden="true" className="grid animate-pulse gap-8 lg:grid-cols-12">
            <div className="aspect-square rounded bg-ivory-200/70 lg:col-span-7" />
            <div className="space-y-4 lg:col-span-5">
              <div className="h-10 w-3/4 rounded bg-ivory-200" />
              <div className="h-6 w-1/3 rounded bg-ivory-200" />
              <div className="h-40 rounded bg-ivory-200/70" />
            </div>
          </div>
        </Container>
      }
    >
      <ProductContent params={props.params} />
    </Suspense>
  );
}
