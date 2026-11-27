import { ButtonAnchor } from '@/components/ui/button';
import { IconWhatsApp } from '@/components/ui/icons';
import { buildWhatsAppUrl, NOT_LISTED_MESSAGE, normaliseWhatsAppNumber } from '@/lib/contact';
import { getBusinessSettings } from '@/lib/data/catalog';

/**
 * Catalogue call-to-action for parts that are not on the website yet. The
 * customer sends their motorcycle model and the part name on WhatsApp.
 * Renders nothing if WhatsApp is not configured (never a broken link).
 */
export async function CantFindPart() {
  const settings = await getBusinessSettings();
  const wa = buildWhatsAppUrl(normaliseWhatsAppNumber(settings.whatsapp_number), NOT_LISTED_MESSAGE);
  if (!wa) return null;

  return (
    <section
      aria-labelledby="not-listed-heading"
      className="mt-14 flex flex-col gap-5 rounded-[var(--radius-plate)] border border-graphite-900/12 bg-ivory-100 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8"
    >
      <div className="max-w-xl">
        <p className="eyebrow mb-2">Not listed yet?</p>
        <h2 id="not-listed-heading" className="font-display text-2xl font-bold uppercase leading-tight sm:text-[1.75rem]">
          Can&apos;t find your part?
        </h2>
        <p className="mt-2 text-stone-600">
          Tell us your motorcycle model and the part name on WhatsApp. We will check genuine stock and get back to you.
        </p>
      </div>
      <ButtonAnchor href={wa} target="_blank" rel="noopener noreferrer" variant="whatsapp" size="lg" className="shrink-0">
        <IconWhatsApp width={22} height={22} /> Ask on WhatsApp
      </ButtonAnchor>
    </section>
  );
}
