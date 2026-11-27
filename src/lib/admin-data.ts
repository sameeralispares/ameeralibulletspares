import 'server-only';
import { partTypeOf } from './part-types';
import type { AdminSession } from './auth';

/** Models or categories with product counts (all statuses except archived), for the admin. */
export async function getTaxonomyWithCounts(db: AdminSession['supabase'], kind: 'models' | 'categories') {
  if (kind === 'models') {
    const [{ data: rows, error }, { data: links }] = await Promise.all([
      db.from('motorcycle_models').select('id, name, slug, description, is_active, sort_order, image_path').order('sort_order').order('name'),
      db
        .from('product_model_compatibility')
        .select('model_id, products!inner(status, part_type)')
        .neq('products.status', 'archived'),
    ]);
    if (error) throw new Error(error.message);
    const counts = new Map<string, { total: number; oem: number; vendor: number }>();
    for (const l of (links ?? []) as unknown as { model_id: string; products: { part_type: string | null } }[]) {
      const c = counts.get(l.model_id) ?? { total: 0, oem: 0, vendor: 0 };
      c.total += 1;
      if (partTypeOf(l.products?.part_type) === 'vendor') c.vendor += 1;
      else c.oem += 1;
      counts.set(l.model_id, c);
    }
    return (rows ?? []).map((r) => {
      const c = counts.get(r.id);
      return { ...r, productCount: c?.total ?? 0, oemCount: c?.oem ?? 0, vendorCount: c?.vendor ?? 0 };
    });
  }
  const [{ data: rows, error }, { data: products }] = await Promise.all([
    db.from('product_categories').select('id, name, slug, description, is_active, sort_order').order('sort_order').order('name'),
    db.from('products').select('category_id').neq('status', 'archived').not('category_id', 'is', null),
  ]);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const p of (products ?? []) as { category_id: string }[]) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);
  return (rows ?? []).map((r) => ({ ...r, productCount: counts.get(r.id) ?? 0 }));
}
