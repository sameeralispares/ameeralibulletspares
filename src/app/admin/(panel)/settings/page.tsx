import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { brandImageUrl } from '@/lib/supabase/env';
import { AdminPageHeader } from '@/components/admin/page-header';
import { SettingsForm } from '@/components/admin/settings-form';
import { HeroImageForm } from '@/components/admin/hero-image-form';
import { StorageSettings } from '@/components/admin/storage-settings';
import { FormAlert } from '@/components/admin/form';
import { providerOf } from '@/lib/image-providers';
import { storageOverview } from '@/lib/image-storage';
import type { BusinessSettings } from '@/lib/types';

export const metadata: Metadata = { title: 'Business details' };

export default async function SettingsPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from('business_settings')
    .select(
      'business_name, address, landline, whatsapp_number, email, opening_hours, google_maps_url, facebook_url, instagram_url, youtube_url, about_intro, about_history, hero_image_path, festive_active, festive_label, festive_discount_type, festive_discount_value, default_image_provider',
    )
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return <FormAlert error="Could not load business details. Please refresh the page." />;
  const settings = data as unknown as BusinessSettings;
  // Live, server-side checks of both providers (never hardcoded labels).
  const storage = await storageOverview(supabase);
  return (
    <>
      <AdminPageHeader
        title="Business details"
        intro="Shown on the website’s contact section, footer and Google listing data. Everything here is public — never put passwords or private notes here."
      />
      <div className="space-y-6">
        <HeroImageForm
          currentUrl={settings.hero_image_path ? brandImageUrl(settings.hero_image_path) : null}
          shopName={settings.business_name}
        />
        <StorageSettings
          current={providerOf(settings.default_image_provider)}
          statuses={storage.statuses}
          imagekitUsage={storage.imagekitUsage}
          supabaseUsage={storage.supabaseUsage}
          imagekitConfigGaps={storage.imagekitConfigGaps}
          pendingCleanups={storage.pendingCleanups}
        />
        <SettingsForm initial={settings} />
      </div>
    </>
  );
}
