import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { AdminPageHeader, Card } from '@/components/admin/page-header';
import { ButtonLink } from '@/components/ui/button';
import { IconAlert, IconPlus } from '@/components/ui/icons';
import { FormAlert } from '@/components/admin/form';

export const metadata: Metadata = { title: 'Dashboard' };

type Stats = {
  published: number;
  draft_or_hidden: number;
  archived: number;
  available: number;
  out_of_stock: number;
  contact_to_confirm: number;
  featured: number;
  without_images: number;
  oem: number;
  vendor: number;
};

export default async function DashboardPage(props: PageProps<'/admin'>) {
  const { supabase } = await requireAdmin();
  const sp = await props.searchParams;
  const [{ data, error }, settingsRes] = await Promise.all([
    supabase.rpc('admin_dashboard_stats'),
    supabase.from('business_settings').select('whatsapp_number, opening_hours, google_maps_url').eq('id', 1).maybeSingle(),
  ]);

  if (error || !data?.[0]) {
    return <FormAlert error="Could not load statistics from the database. Please refresh the page." />;
  }
  const raw = data[0] as Record<keyof Stats, number | string>;
  const s = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)])) as Stats;

  const tiles: { label: string; value: number; href: string; tone?: string }[] = [
    { label: 'Published', value: s.published, href: '/admin/products?status=published', tone: 'text-ok-700' },
    { label: 'Draft / hidden', value: s.draft_or_hidden, href: '/admin/products?status=unpublished' },
    { label: 'Available', value: s.available, href: '/admin/products?availability=available', tone: 'text-ok-700' },
    { label: 'Out of stock', value: s.out_of_stock, href: '/admin/products?availability=out_of_stock', tone: 'text-stop-700' },
    { label: 'Need confirmation', value: s.contact_to_confirm, href: '/admin/products?availability=contact_to_confirm', tone: 'text-ask-700' },
    { label: 'Featured', value: s.featured, href: '/admin/products?featured=1' },
    { label: 'OEM stock', value: s.oem, href: '/admin/products?type=oem' },
    { label: 'Vendor stock', value: s.vendor, href: '/admin/products?type=vendor' },
  ];

  const settings = settingsRes.data;
  const todo: { text: string; href: string }[] = [];
  if (settings && !settings.whatsapp_number) todo.push({ text: 'Add the shop’s WhatsApp number to turn on WhatsApp enquiries', href: '/admin/settings' });
  if (settings && !settings.opening_hours) todo.push({ text: 'Add opening hours so customers know when to visit', href: '/admin/settings' });
  if (settings && !settings.google_maps_url) todo.push({ text: 'Paste the shop’s Google Maps link for accurate directions', href: '/admin/settings' });
  if (s.without_images > 0) todo.push({ text: `${s.without_images} product${s.without_images === 1 ? ' has' : 's have'} no photos yet`, href: '/admin/products?photos=missing' });
  if (s.published + s.draft_or_hidden === 0) todo.push({ text: 'Add your first product', href: '/admin/products/new' });

  return (
    <>
      {sp.password_updated ? <div className="mb-4"><FormAlert message="Your password has been updated." /></div> : null}
      <AdminPageHeader
        title="Dashboard"
        intro="Live numbers from your catalogue."
        action={
          <ButtonLink href="/admin/products/new" className="w-full sm:w-auto">
            <IconPlus /> Add product
          </ButtonLink>
        }
      />

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="block h-full">
              <Card className="h-full p-4 transition-colors hover:border-bronze-500 sm:p-5">
                <p className="text-sm font-medium text-stone-600">{t.label}</p>
                <p className={`mt-2 font-display text-[2.5rem] font-bold leading-none ${t.tone ?? 'text-ink'}`}>{t.value}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>

      {todo.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold uppercase">
            <IconAlert className="text-ask-700" /> To do
          </h2>
          <ul className="mt-3 divide-y divide-graphite-900/10">
            {todo.map((t) => (
              <li key={t.text}>
                <Link href={t.href} className="flex min-h-12 items-center justify-between gap-3 py-2 text-[0.9375rem] hover:text-bronze-700">
                  {t.text} <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {s.archived > 0 && (
        <p className="mt-4 text-sm text-stone-600">
          {s.archived} archived product{s.archived === 1 ? '' : 's'} (not counted above).{' '}
          <Link className="font-semibold underline underline-offset-4" href="/admin/products?status=archived">
            View
          </Link>
        </p>
      )}
    </>
  );
}
