import { BrandMark } from '@/components/site/brand';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-blueprint flex min-h-screen flex-col items-center px-4 py-10 sm:justify-center">
      <div className="mb-8">
        <BrandMark tone="dark" />
      </div>
      <main id="main" className="w-full max-w-md rounded-lg bg-ivory-50 p-6 shadow-2xl sm:p-8">
        {children}
      </main>
      <p className="mt-6 text-center text-xs text-ivory-200/60">Shop owner access only. Customers do not need an account.</p>
    </div>
  );
}
