import type { Metadata } from 'next';
import { getBusinessSettings } from '@/lib/data/catalog';
import { normaliseWhatsAppNumber, telHref } from '@/lib/contact';
import { pageMetadata } from '@/lib/seo';
import { OrderForm } from '@/components/cart/order-form';

export const metadata: Metadata = pageMetadata({
  title: 'Place your order',
  description: 'Enter your details and send your parts order to the shop on WhatsApp.',
  path: '/cart/order',
  noindex: true,
});

export default async function OrderPage() {
  const settings = await getBusinessSettings();
  return (
    <OrderForm
      whatsappNumber={normaliseWhatsAppNumber(settings.whatsapp_number)}
      landline={settings.landline}
      telHref={telHref(settings.landline)}
    />
  );
}
