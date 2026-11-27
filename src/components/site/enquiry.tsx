import { ButtonAnchor } from '@/components/ui/button';
import { IconPhone, IconWhatsApp } from '@/components/ui/icons';
import { buildEnquiryMessage, buildWhatsAppUrl, telHref, type EnquiryContext } from '@/lib/contact';
import type { BusinessSettings } from '@/lib/types';

/**
 * The single source of "how do I contact the shop" buttons.
 *  - WhatsApp number configured & valid -> WhatsApp enquiry (pre-filled) + call.
 *  - Not configured                     -> call the confirmed landline instead.
 * A broken or empty WhatsApp link is never rendered.
 */
export function EnquiryActions({
  settings,
  context,
  size = 'md',
  tone = 'light',
  showCall = true,
  className = '',
  fullWidth = false,
}: {
  settings: BusinessSettings;
  context?: EnquiryContext;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'light' | 'dark';
  showCall?: boolean;
  className?: string;
  fullWidth?: boolean;
}) {
  const wa = buildWhatsAppUrl(settings.whatsapp_number, buildEnquiryMessage(context));
  const tel = telHref(settings.landline);
  const w = fullWidth ? 'w-full sm:w-auto' : '';

  if (!wa && !tel) return null;

  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:flex-wrap ${className}`}>
      {wa ? (
        <ButtonAnchor
          variant="whatsapp"
          size={size}
          href={wa}
          target="_blank"
          rel="noopener noreferrer"
          className={w}
          data-testid="whatsapp-enquiry"
        >
          <IconWhatsApp width={22} height={22} /> Enquire on WhatsApp
        </ButtonAnchor>
      ) : null}
      {tel && (showCall || !wa) ? (
        <ButtonAnchor
          variant={tone === 'dark' ? 'outline-light' : wa ? 'outline' : 'primary'}
          size={size}
          href={tel}
          className={w}
          data-testid="call-shop"
        >
          <IconPhone /> {wa ? `Call ${settings.landline}` : `Call to check · ${settings.landline}`}
        </ButtonAnchor>
      ) : null}
    </div>
  );
}

export function hasWhatsApp(settings: BusinessSettings): boolean {
  return Boolean(buildWhatsAppUrl(settings.whatsapp_number, 'x'));
}
