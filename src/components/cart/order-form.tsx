'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Button, ButtonAnchor, ButtonLink, buttonClasses } from '@/components/ui/button';
import { IconPhone, IconWhatsApp } from '@/components/ui/icons';
import { Container } from '@/components/ui/primitives';
import { Field, TextInput, TextArea } from '@/components/admin/form';
import { lineKey } from '@/lib/cart';
import { SUPPLY_LABEL } from '@/lib/part-types';
import {
  buildOrderMessage,
  buildOrderUrl,
  cartCount,
  cartTotal,
  orderDetailsSchema,
  type CartLine,
  type OrderDetails,
} from '@/lib/cart';
import { formatINR } from '@/lib/pricing';
import { useCart } from './cart-context';

type Props = {
  /** Digits-only WhatsApp number of the shop, or null when not configured. */
  whatsappNumber: string | null;
  landline: string | null;
  telHref: string | null;
};

type Step = 'details' | 'review' | 'sent';
type Errors = Partial<Record<keyof OrderDetails, string>>;

export function OrderForm({ whatsappNumber, landline, telHref }: Props) {
  const { lines, ready, clear } = useCart();
  const [step, setStep] = useState<Step>('details');
  const [errors, setErrors] = useState<Errors>({});
  const [details, setDetails] = useState<OrderDetails | null>(null);
  const [sentUrl, setSentUrl] = useState<string | null>(null);

  if (!ready) {
    return (
      <Container className="py-10">
        <div className="h-64 animate-pulse rounded bg-ivory-200/70" aria-hidden="true" />
      </Container>
    );
  }

  if (lines.length === 0 && step !== 'sent') {
    return (
      <Container className="py-14 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">Your cart is empty</h1>
        <p className="mx-auto mt-3 max-w-md text-stone-600">Add parts to your cart before placing an order.</p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/products" variant="primary" size="lg">
            Browse parts
          </ButtonLink>
        </div>
      </Container>
    );
  }

  function onReview(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = {
      name: String(fd.get('name') ?? ''),
      mobile: String(fd.get('mobile') ?? ''),
      address: String(fd.get('address') ?? ''),
      motorcycle: String(fd.get('motorcycle') ?? ''),
      note: String(fd.get('note') ?? ''),
    };
    const parsed = orderDetailsSchema.safeParse(raw);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof OrderDetails;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setDetails(parsed.data);
    setStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function onConfirm() {
    if (!details) return;
    const url = buildOrderUrl(whatsappNumber, lines, details);
    if (!url) return;
    setSentUrl(url);
    setStep('sent');
    // Opened from the click itself, so browsers do not block it as a pop-up.
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (step === 'sent') {
    return (
      <Container className="py-12 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">Order ready to send</h1>
        <p className="mx-auto mt-3 max-w-lg text-stone-700">
          WhatsApp should have opened with your order. Press send there to place it with the shop. If nothing opened, use the button below.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {sentUrl && (
            <ButtonAnchor href={sentUrl} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg">
              <IconWhatsApp width={22} height={22} /> Open WhatsApp
            </ButtonAnchor>
          )}
          <Button variant="outline" size="lg" onClick={clear}>
            Clear cart
          </Button>
        </div>
        <p className="mt-6 text-sm text-stone-600">
          Your cart is kept until you clear it, so you can change the order and send it again.
        </p>
      </Container>
    );
  }

  const totals = cartTotal(lines);

  if (step === 'review' && details) {
    const message = buildOrderMessage(lines, details);
    return (
      <Container className="py-8 sm:py-10">
        <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">Check your order</h1>
        <p className="mt-2 text-stone-600">Confirm the details below. WhatsApp will open with this message, ready to send.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7" aria-labelledby="order-items">
            <h2 id="order-items" className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">
              Parts
            </h2>
            <ReviewLines lines={lines} />
            <p className="mt-4 font-display text-xl font-bold">
              Total {formatINR(totals.pricedTotal)}
              {!totals.allPriced && <span className="ml-2 text-sm font-normal text-stone-600">+ {totals.unpricedLines} on enquiry</span>}
            </p>
          </section>

          <section className="lg:col-span-5" aria-labelledby="order-details">
            <h2 id="order-details" className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">
              Your details
            </h2>
            <dl className="mt-3 space-y-2 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 text-sm">
              <Row label="Name" value={details.name} />
              <Row label="Mobile" value={details.mobile} />
              <Row label="Address / delivery" value={details.address || 'Collect from the shop'} />
              {details.motorcycle && <Row label="Motorcycle" value={details.motorcycle} />}
              {details.note && <Row label="Note" value={details.note} />}
            </dl>
            <Button variant="outline" size="md" className="mt-3 w-full sm:w-auto" onClick={() => setStep('details')}>
              Edit details
            </Button>
          </section>
        </div>

        <details className="mt-8 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-ivory-100 p-4">
          <summary className="cursor-pointer font-semibold">Message that will be sent</summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-stone-800">{message}</p>
        </details>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {whatsappNumber ? (
            <Button variant="whatsapp" size="lg" className="w-full sm:w-auto" onClick={onConfirm} data-testid="confirm-order">
              <IconWhatsApp width={22} height={22} /> Confirm and send on WhatsApp
            </Button>
          ) : (
            <p className="text-sm text-stone-700">Online ordering is not available right now. Please call the shop.</p>
          )}
          <Link href="/cart" className={buttonClasses('ghost', 'lg', 'w-full sm:w-auto')}>
            Back to cart
          </Link>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10">
      <h1 className="font-display text-3xl font-bold uppercase leading-tight sm:text-4xl">Your details</h1>
      <p className="mt-2 max-w-2xl text-stone-600">
        Fill in your details so the shop can confirm your order. {cartCount(lines)} part{cartCount(lines) === 1 ? '' : 's'} in your cart.
      </p>

      <form onSubmit={onReview} noValidate className="mt-8 grid max-w-2xl gap-5" aria-label="Order details">
        <Field label="Your name" htmlFor="name" error={errors.name} required>
          <TextInput id="name" name="name" autoComplete="name" maxLength={80} defaultValue={details?.name ?? ''} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Mobile number" htmlFor="mobile" error={errors.mobile} required hint="The shop will reply on WhatsApp to this number.">
          <TextInput id="mobile" name="mobile" type="tel" autoComplete="tel" inputMode="tel" defaultValue={details?.mobile ?? ''} aria-invalid={Boolean(errors.mobile)} />
        </Field>
        <Field label="Address or delivery location" htmlFor="address" error={errors.address} hint="Optional. Leave blank if you will collect from the shop.">
          <TextArea id="address" name="address" rows={2} maxLength={300} autoComplete="street-address" defaultValue={details?.address ?? ''} />
        </Field>
        <Field label="Motorcycle model and year" htmlFor="motorcycle" error={errors.motorcycle} hint="Optional. Helps the shop confirm the right part.">
          <TextInput id="motorcycle" name="motorcycle" maxLength={80} defaultValue={details?.motorcycle ?? ''} />
        </Field>
        <Field label="Note for the shop" htmlFor="note" error={errors.note} hint="Optional.">
          <TextArea id="note" name="note" rows={3} maxLength={400} defaultValue={details?.note ?? ''} />
        </Field>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row">
          <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
            Review order
          </Button>
          <Link href="/cart" className={buttonClasses('ghost', 'lg', 'w-full sm:w-auto')}>
            Back to cart
          </Link>
        </div>
      </form>

      {telHref && landline && (
        <p className="mt-8 flex items-center gap-2 text-sm text-stone-600">
          <IconPhone width={18} height={18} /> Prefer to talk? Call <a href={telHref} className="font-semibold text-ink underline">{landline}</a>.
        </p>
      )}
    </Container>
  );
}

function ReviewLines({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="mt-3 divide-y divide-graphite-900/10 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white">
      {lines.map((l) => (
        <li key={lineKey(l)} className="flex items-start justify-between gap-4 p-4 text-sm">
          <div className="min-w-0">
            <p className="font-semibold [overflow-wrap:anywhere]">{l.name}</p>
            {l.partNumber && <p className="font-mono text-xs text-stone-600">Part no. {l.partNumber}</p>}
            <p className="text-stone-700">{SUPPLY_LABEL[l.partType]} stock · Qty {l.qty}</p>
          </div>
          <p className="shrink-0 font-semibold">{l.unitPrice === null ? 'On enquiry' : formatINR(l.unitPrice * l.qty)}</p>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-2">
      <dt className="text-stone-600">{label}</dt>
      <dd className="font-medium [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}
