'use client';

import { useEffect, useState } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { IconCheck, IconWhatsApp } from '@/components/ui/icons';
import { buildPartShareMessage, buildWhatsAppShareUrl } from '@/lib/contact';

type Props = {
  productName: string;
  partNumber: string | null;
  /** Absolute public URL of this part page. */
  url: string;
};

/**
 * Small helpers under the enquiry panel: copy the part number (so a rider can
 * quote it to the shop) and share the part with a friend or mechanic. Uses the
 * phone's share sheet when available, otherwise opens WhatsApp directly.
 */
export function PartTools({ productName, partNumber, url }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const message = buildPartShareMessage({ productName, partNumber, url });

  async function copyPartNumber() {
    if (!partNumber) return;
    try {
      await navigator.clipboard.writeText(partNumber);
      setCopied(true);
    } catch {
      // Clipboard can be blocked (e.g. insecure context). Nothing to show.
    }
  }

  async function share() {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: productName, text: message, url });
        return;
      } catch (err) {
        // The user closing the share sheet is not an error.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    window.open(buildWhatsAppShareUrl(message), '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {partNumber && (
        <button type="button" onClick={copyPartNumber} className={buttonClasses('ghost', 'sm')} aria-label={`Copy part number ${partNumber}`}>
          {copied ? (
            <>
              <IconCheck width={18} height={18} /> Copied
            </>
          ) : (
            'Copy part no.'
          )}
        </button>
      )}
      <button type="button" onClick={share} className={buttonClasses('ghost', 'sm')} data-testid="share-part">
        <IconWhatsApp width={18} height={18} /> Share this part
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Part number copied' : ''}
      </span>
    </div>
  );
}
