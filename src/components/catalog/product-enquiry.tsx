'use client';

import { useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { IconPhone, IconWhatsApp } from '@/components/ui/icons';
import { buildEnquiryMessage, buildWhatsAppUrl } from '@/lib/contact';

type Props = {
  whatsappNumber: string | null;
  landline: string | null;
  telHref: string | null;
  productName: string;
  partNumber: string | null;
  models: { slug: string; name: string }[];
  variant?: 'panel' | 'bar';
};

/**
 * WhatsApp enquiry for one product. When the part fits several models the
 * customer can say which motorcycle it's for; the message updates instantly.
 * Falls back to a phone call when WhatsApp isn't configured.
 */
export function ProductEnquiry({ whatsappNumber, landline, telHref, productName, partNumber, models, variant = 'panel' }: Props) {
  const [model, setModel] = useState<string | null>(models.length === 1 ? models[0].name : null);
  const message = buildEnquiryMessage({ productName, partNumber, modelName: model });
  const wa = buildWhatsAppUrl(whatsappNumber, message);

  if (variant === 'bar') {
    return (
      <div className="flex gap-2">
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'md', 'flex-1')}>
            <IconWhatsApp width={22} height={22} /> WhatsApp
          </a>
        ) : null}
        {telHref ? (
          <a href={telHref} className={buttonClasses(wa ? 'outline-light' : 'primary', 'md', wa ? 'px-4' : 'flex-1')} aria-label={`Call ${landline}`}>
            <IconPhone /> {wa ? 'Call' : `Call to check · ${landline}`}
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-plate)] border border-graphite-900/12 bg-ivory-100 p-4 sm:p-5">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-stone-600">Check availability</p>

      {wa && models.length > 1 && (
        <fieldset className="mt-3">
          <legend className="text-sm text-stone-600">Which motorcycle is it for? (optional)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {models.map((m) => {
              const selected = model === m.name;
              return (
                <button
                  key={m.slug}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setModel(selected ? null : m.name)}
                  className={`min-h-10 rounded-full border px-3.5 text-sm font-medium transition-colors ${
                    selected ? 'border-ink bg-ink text-ivory-50' : 'border-graphite-900/20 bg-white hover:border-graphite-900'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mt-4 flex flex-col gap-2.5">
        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses('whatsapp', 'lg', 'w-full')}
            data-testid="whatsapp-enquiry"
          >
            <IconWhatsApp width={22} height={22} /> Enquire on WhatsApp
          </a>
        ) : null}
        {telHref ? (
          <a href={telHref} className={buttonClasses(wa ? 'outline' : 'primary', 'lg', 'w-full')} data-testid="call-shop">
            <IconPhone /> {wa ? `Call ${landline}` : `Call to check · ${landline}`}
          </a>
        ) : null}
      </div>
      {wa && (
        <p className="mt-3 text-xs leading-relaxed text-stone-600">
          Opens WhatsApp with this message: <span className="italic">“{message}”</span>
        </p>
      )}
    </div>
  );
}
