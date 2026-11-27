import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getTaxonomyWithCounts } from '@/lib/admin-data';
import { AdminPageHeader } from '@/components/admin/page-header';
import { TaxonomyManager } from '@/components/admin/taxonomy-manager';
import { IconAlert } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Part categories' };

export default async function CategoriesAdminPage() {
  const { supabase } = await requireAdmin();
  const items = await getTaxonomyWithCounts(supabase, 'categories');
  return (
    <>
      <AdminPageHeader title="Part categories" intro="Group parts so customers can browse them. Rename, reorder or add categories to match your shop." />
      <div className="mb-5 flex gap-3 rounded-md bg-ask-50 p-4 text-sm text-ask-700 ring-1 ring-ask-700/20">
        <IconAlert className="mt-0.5 shrink-0" />
        <p>
          The starting categories were <strong>suggestions</strong> made during setup. Please check them against your actual stock and
          edit, deactivate or add categories as needed. A category only appears on the website once it contains a published product.
        </p>
      </div>
      <TaxonomyManager kind="categories" items={items} />
    </>
  );
}
