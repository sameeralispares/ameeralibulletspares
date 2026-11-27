import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getTaxonomyWithCounts } from '@/lib/admin-data';
import { AdminPageHeader } from '@/components/admin/page-header';
import { TaxonomyManager } from '@/components/admin/taxonomy-manager';
import { ModelGalleryAdmin, type AdminModel } from '@/components/admin/model-gallery';

export const metadata: Metadata = { title: 'Motorcycle models' };

export default async function ModelsAdminPage() {
  const { supabase } = await requireAdmin();
  const items = await getTaxonomyWithCounts(supabase, 'models');
  return (
    <>
      <AdminPageHeader
        title="Motorcycle models"
        intro="These appear on the website’s “Shop by model” pages in this order. Open a model to see the parts listed for it, or upload a photograph to replace the drawing. Deactivate a model to hide it without losing product links."
      />
      <ModelGalleryAdmin models={items as unknown as AdminModel[]} />
      <TaxonomyManager kind="models" items={items} />
    </>
  );
}
