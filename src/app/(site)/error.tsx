'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/primitives';
import { SHOP_PHONE } from '@/lib/site';
import { telHref } from '@/lib/contact';

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-20">
      <p className="eyebrow">Something went wrong</p>
      <h1 className="mt-2 text-[2.25rem] font-bold uppercase">We couldn&apos;t load this page</h1>
      <p className="mt-3 max-w-lg text-stone-600">
        This is usually temporary. Please try again — or call the shop on{' '}
        <a href={telHref(SHOP_PHONE) ?? undefined} className="font-semibold text-ink underline underline-offset-4">
          {SHOP_PHONE}
        </a>
        .
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => reset()}>Try again</Button>
        <ButtonLink href="/" variant="outline">
          Go to home page
        </ButtonLink>
      </div>
      {error.digest && <p className="mt-6 font-mono text-xs text-stone-500">Reference: {error.digest}</p>}
    </Container>
  );
}
