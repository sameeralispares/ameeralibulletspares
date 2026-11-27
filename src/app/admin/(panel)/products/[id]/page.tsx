import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { AdminPageHeader, StatusBadge } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/product-form';
import { ImageManager } from '@/components/admin/image-manager';
import { ProductDangerZone } from '@/components/admin/product-danger-zone';
import { FormAlert } from '@/components/admin/form';
import { IconExternal } from '@/components/ui/icons';
import { providerOf } from '@/lib/image-providers';
import { partTypeOf } from '@/lib/part-types';
import { isImageKitConfigured } from '@/lib/imagekit-server';
import type { ProductImage } from '@/lib/types';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditProductPage(props: PageProps<'/admin/products/[id]'>) {
  const { supabase } = await requireAdmin();
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [productRes, models, categories] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id, name, slug, part_number, description, category_id, availability, status, is_featured, seo_title, seo_description, mrp, offer_price, part_type, vendor_mrp, vendor_offer_price, images:product_images ( id, storage_path, alt_text, width, height, sort_order, is_primary, storage_provider, image_url ), compat:product_model_compatibility ( model_id )',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('motorcycle_models').select('id, name, is_active').order('sort_order'),
    supabase.from('product_categories').select('id, name, is_active').order('sort_order'),
  ]);
  const { data: settings } = await supabase.from('business_settings').select('default_image_provider').eq('id', 1).maybeSingle();
  const p = productRes.data;
  if (!p) notFound();
  const images = (p.images ?? []) as ProductImage[];
  const modelIds = ((p.compat ?? []) as { model_id: string }[]).map((c) => c.model_id);

  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-bronze-700">← All products</Link>
      {sp.created ? <div className="mb-4"><FormAlert message="Product created. Now add photos below, then publish when ready." /></div> : null}
      <AdminPageHeader
        title={p.name}
        intro={<span className="flex flex-wrap items-center gap-2"><StatusBadge status={p.status} />{p.status === 'published' ? 'Visible on the website.' : 'Not visible on the website.'}</span>}
        action={
          p.status === 'published' ? (
            <Link href={`/products/${p.slug}`} target="_blank" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-bronze-700 underline underline-offset-4">
              View on website <IconExternal width={16} height={16} />
            </Link>
          ) : undefined
        }
      />
      <div className="space-y-6">
        <ImageManager
          productId={p.id}
          productName={p.name}
          images={images}
          defaultProvider={providerOf(settings?.default_image_provider)}
          imagekitReady={isImageKitConfigured()}
        />
        <ProductForm
          key={p.status}
          initial={{
            id: p.id, name: p.name, slug: p.slug, part_number: p.part_number, description: p.description,
            category_id: p.category_id, availability: p.availability, status: p.status, is_featured: p.is_featured,
            seo_title: p.seo_title, seo_description: p.seo_description, model_ids: modelIds,
            mrp: p.mrp == null ? null : Number(p.mrp), offer_price: p.offer_price == null ? null : Number(p.offer_price),
            part_type: partTypeOf(p.part_type),
            vendor_mrp: p.vendor_mrp == null ? null : Number(p.vendor_mrp),
            vendor_offer_price: p.vendor_offer_price == null ? null : Number(p.vendor_offer_price),
          }}
          models={models.data ?? []}
          categories={categories.data ?? []}
        />
        <ProductDangerZone id={p.id} name={p.name} status={p.status} />
      </div>
    </>
  );
}
