import Link from 'next/link';
import type { Metadata } from 'next';
import { ButtonLink } from '@/components/ui/button';
import { BrandMark } from '@/components/site/brand';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

export default function NotFound() {
  return (
    <div className="bg-blueprint flex min-h-screen flex-col text-ivory-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8">
        <BrandMark tone="dark" />
      </div>
      <main id="main" className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 pb-24 sm:px-6 lg:px-8">
        <p className="font-mono text-sm text-bronze-300">Error 404</p>
        <h1 className="mt-3 max-w-2xl text-[2.75rem] font-bold uppercase leading-none text-ivory-50 sm:text-[4rem]">
          This page isn&apos;t on the shelf
        </h1>
        <p className="mt-5 max-w-lg text-ivory-200/85">
          The part or page may have been removed or renamed. Try browsing by motorcycle model or searching the catalogue.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/models">Shop by model</ButtonLink>
          <ButtonLink href="/products" variant="outline-light">
            Search all parts
          </ButtonLink>
        </div>
        <p className="mt-10 text-sm text-ivory-200/70">
          <Link href="/" className="underline underline-offset-4 hover:text-ivory-50">
            Back to home
          </Link>{' '}
          ·{' '}
          <Link href="/contact" className="underline underline-offset-4 hover:text-ivory-50">
            Contact the shop
          </Link>
        </p>
      </main>
    </div>
  );
}
