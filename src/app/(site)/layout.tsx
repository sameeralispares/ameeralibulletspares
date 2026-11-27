import { CartProvider } from '@/components/cart/cart-context';
import { SiteFooter } from '@/components/site/footer';
import { SiteHeader } from '@/components/site/header';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <SiteHeader />
      <main id="main" className="min-h-[60vh]">
        {children}
      </main>
      <SiteFooter />
    </CartProvider>
  );
}
