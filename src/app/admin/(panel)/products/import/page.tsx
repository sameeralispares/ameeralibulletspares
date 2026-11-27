import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { AdminPageHeader } from '@/components/admin/page-header';
import { ImportForm } from '@/components/admin/import-form';

export const metadata: Metadata = { title: 'Import products' };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <Link href="/admin/products" className="mb-3 inline-flex min-h-11 items-center text-sm font-semibold text-bronze-700">← All products</Link>
      <AdminPageHeader
        title="Import from a parts list"
        intro={
          <>
            Add many products at once from a spreadsheet saved as CSV.{' '}
            <a href="/templates/products-import-template.csv" download className="font-semibold text-bronze-700 underline underline-offset-4">
              Download the template
            </a>
            .
          </>
        }
      />
      <div className="mb-6 rounded-md bg-ivory-100 p-4 text-sm leading-relaxed text-graphite-800 ring-1 ring-graphite-900/10">
        <p className="font-semibold">Columns</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li><strong>name</strong> (required) — e.g. Clutch Plate Set</li>
          <li><strong>part_number</strong> — the Royal Enfield part number, or the number the vendor uses</li>
          <li><strong>category</strong> — must match a category name</li>
          <li><strong>models</strong> — model names separated by <code>;</code> e.g. <code>Classic; Bullet</code></li>
          <li><strong>availability</strong> — Available, Out of Stock or Contact to Confirm (default)</li>
          <li><strong>status</strong> — draft (default) or published</li>
          <li><strong>type</strong> — oem (default), vendor or both: which supply the stock came through. All are genuine parts. A “both” row gets its vendor price later in the admin.</li>
          <li><strong>description</strong> — optional plain facts</li>
        </ul>
        <p className="mt-2">No prices or stock counts are imported — the website does not show prices.</p>
      </div>
      <ImportForm />
    </>
  );
}
