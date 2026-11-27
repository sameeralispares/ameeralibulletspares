import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';

export default function SiteNotFound() {
  return (
    <Container className="py-20 sm:py-28">
      <p className="font-mono text-sm text-bronze-700">Error 404</p>
      <h1 className="mt-3 max-w-2xl text-[2.5rem] font-bold uppercase leading-none sm:text-[3.5rem]">
        This page isn&apos;t on the shelf
      </h1>
      <p className="mt-5 max-w-lg text-stone-600">
        The part or page may have been removed or renamed. Try browsing by motorcycle model or searching the catalogue.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/models">Shop by model</ButtonLink>
        <ButtonLink href="/products" variant="outline">Search all parts</ButtonLink>
      </div>
      <p className="mt-8 text-sm text-stone-600">
        Need help? <Link href="/contact" className="font-semibold text-ink underline underline-offset-4">Contact the shop</Link>
      </p>
    </Container>
  );
}
