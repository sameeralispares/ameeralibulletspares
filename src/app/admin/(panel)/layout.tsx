import { Suspense } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { BrandMark } from '@/components/site/brand';
import { AdminBottomNav, AdminSideNav, BottomNavList, SideNavList } from '@/components/admin/admin-nav';
import { IconExternal, IconLogout } from '@/components/ui/icons';
import { signOut } from '../(auth)/actions';

async function AdminGate({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <>
      <div className="hidden border-b border-graphite-900/10 bg-white px-4 py-2 text-right text-xs text-stone-600 lg:block">
        Signed in as <span className="font-semibold text-ink">{session.email}</span>
      </div>
      {children}
    </>
  );
}

function PanelSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse space-y-4 p-4">
      <div className="h-9 w-48 rounded bg-ivory-200" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded bg-ivory-200/70" />
        ))}
      </div>
    </div>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-graphite-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandMark tone="dark" compact />
            <span className="rounded bg-bronze-500 px-1.5 py-0.5 font-display text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-ink">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/"
              target="_blank"
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-ivory-100 hover:bg-white/10"
            >
              <IconExternal width={18} height={18} /> <span className="hidden sm:inline">View website</span>
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-ivory-100 hover:bg-white/10"
              >
                <IconLogout width={18} height={18} /> <span className="hidden sm:inline">Sign out</span>
                <span className="sr-only sm:hidden">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 pb-28 pt-6 sm:px-6 lg:pb-12">
        <aside className="w-56 shrink-0 max-lg:hidden">
          <div className="sticky top-24">
            <Suspense fallback={<SideNavList pathname="" />}>
              <AdminSideNav />
            </Suspense>
          </div>
        </aside>
        <main id="main" className="min-w-0 flex-1">
          <Suspense fallback={<PanelSkeleton />}>
            <AdminGate>{children}</AdminGate>
          </Suspense>
        </main>
      </div>
      <Suspense fallback={<BottomNavList pathname="" />}>
        <AdminBottomNav />
      </Suspense>
    </div>
  );
}
