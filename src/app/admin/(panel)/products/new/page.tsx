import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { AdminPageHeader } from '@/components/admin/page-header';
import { ProductForm } from '@/components/admin/product-form';

export const metadata: Metadata = { title: 'Add product' };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const [models, categories] = await Promise.all([
    supabase.from('motorcycle_models').select('id, name, is_active').order('sort_order'),
    supabase.from('product_categories').select('id, name, is_active').order('sort_order'),
  ]);
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-bronze-700">← All products</Link>
      <AdminPageHeader title="Add product" intro="New products start as drafts. Publish when the details and photos are ready." />
      <ProductForm
        initial={{
          name: '', slug: '', part_number: null, description: null, category_id: null,
          availability: 'contact_to_confirm', status: 'draft', is_featured: false,
          seo_title: null, seo_description: null, model_ids: [], mrp: null, offer_price: null,
          part_type: 'oem', vendor_mrp: null, vendor_offer_price: null,
        }}
        models={models.data ?? []}
        categories={categories.data ?? []}
      />
    </>
  );
}
