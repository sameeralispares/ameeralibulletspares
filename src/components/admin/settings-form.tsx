'use client';

import { useActionState } from 'react';
import { saveSettings, type ActionState } from '@/app/admin/(panel)/actions';
import { Field, FormAlert, SelectInput, SubmitButton, TextArea, TextInput, submitWithoutReset } from './form';
import type { BusinessSettings } from '@/lib/types';

const UNCONFIRMED = 'Leave blank until confirmed — blank fields are hidden on the website.';

export function SettingsForm({ initial }: { initial: BusinessSettings }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettings, null);
  const fe = state?.fieldErrors ?? {};
  const v = (k: 'business_name' | 'address' | 'landline' | 'whatsapp_number' | 'email' | 'opening_hours' | 'google_maps_url' | 'facebook_url' | 'instagram_url' | 'youtube_url' | 'about_intro' | 'about_history') =>
    initial[k] ?? '';

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" noValidate>
      <FormAlert error={state?.error} message={state?.message} />

      <section className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-bold uppercase">Shop details</h2>
        <Field label="Business name" htmlFor="business_name" required error={fe.business_name}>
          <TextInput id="business_name" name="business_name" defaultValue={v('business_name')} maxLength={120} />
        </Field>
        <Field label="Address" htmlFor="address" error={fe.address}>
          <TextArea id="address" name="address" rows={2} defaultValue={v('address')} maxLength={300} className="min-h-20" />
        </Field>
        <Field label="Landline" htmlFor="landline" error={fe.landline}>
          <TextInput id="landline" name="landline" type="tel" defaultValue={v('landline')} maxLength={20} />
        </Field>
        <Field
          label="WhatsApp number"
          htmlFor="whatsapp_number"
          error={fe.whatsapp_number}
          hint="The shop’s WhatsApp number with country code, e.g. +91 96770 93315. The same number as the landline is fine. When blank, customers see a “Call” button instead."
        >
          <TextInput id="whatsapp_number" name="whatsapp_number" type="tel" inputMode="tel" defaultValue={v('whatsapp_number')} maxLength={25} />
        </Field>
        <Field label="Opening hours" htmlFor="opening_hours" error={fe.opening_hours} hint={`One line per day range, e.g. “Mon–Sat: 10am – 8pm”. ${UNCONFIRMED}`}>
          <TextArea id="opening_hours" name="opening_hours" rows={3} defaultValue={v('opening_hours')} maxLength={500} className="min-h-24" />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email} hint={UNCONFIRMED}>
          <TextInput id="email" name="email" type="email" defaultValue={v('email')} maxLength={200} />
        </Field>
        <Field
          label="Google Maps link"
          htmlFor="google_maps_url"
          error={fe.google_maps_url}
          hint="Open the shop in Google Maps → Share → Copy link, and paste it here. Until then, directions use the address text."
        >
          <TextInput id="google_maps_url" name="google_maps_url" type="url" inputMode="url" defaultValue={v('google_maps_url')} maxLength={500} />
        </Field>
      </section>

      <section className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-bold uppercase">Festive offer</h2>
          <p className="mt-1 text-sm text-stone-600">
            Switch on for festivals. Every part with an MRP is discounted, and a banner shows on the home page. A part with its own offer price keeps that price.
          </p>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-[0.9375rem] font-medium text-ink">
          <input
            type="checkbox"
            name="festive_active"
            defaultChecked={initial.festive_active}
            className="h-5 w-5 accent-[var(--color-graphite-900)]"
          />
          Festive offer is on
        </label>
        <Field label="Banner text" htmlFor="festive_label" error={fe.festive_label} hint="For example “Pongal Sale”. Leave blank for no banner text.">
          <TextInput id="festive_label" name="festive_label" maxLength={80} defaultValue={initial.festive_label ?? ''} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Discount type" htmlFor="festive_discount_type" error={fe.festive_discount_type}>
            <SelectInput id="festive_discount_type" name="festive_discount_type" defaultValue={initial.festive_discount_type}>
              <option value="percent">Percentage off MRP (%)</option>
              <option value="amount">Rupees off MRP (₹)</option>
            </SelectInput>
          </Field>
          <Field label="Discount value" htmlFor="festive_discount_value" error={fe.festive_discount_value} hint="e.g. 10 for 10%, or 200 for ₹200 off.">
            <TextInput
              id="festive_discount_value"
              name="festive_discount_value"
              inputMode="decimal"
              defaultValue={initial.festive_discount_value ? String(initial.festive_discount_value) : ''}
              placeholder="0"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-bold uppercase">Social media</h2>
          <p className="mt-1 text-sm text-stone-600">Only add accounts the shop actually owns.</p>
        </div>
        <Field label="Facebook page" htmlFor="facebook_url" error={fe.facebook_url}>
          <TextInput id="facebook_url" name="facebook_url" type="url" defaultValue={v('facebook_url')} maxLength={500} placeholder="https://" />
        </Field>
        <Field label="Instagram" htmlFor="instagram_url" error={fe.instagram_url}>
          <TextInput id="instagram_url" name="instagram_url" type="url" defaultValue={v('instagram_url')} maxLength={500} placeholder="https://" />
        </Field>
        <Field label="YouTube" htmlFor="youtube_url" error={fe.youtube_url}>
          <TextInput id="youtube_url" name="youtube_url" type="url" defaultValue={v('youtube_url')} maxLength={500} placeholder="https://" />
        </Field>
      </section>

      <section className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-bold uppercase">About page</h2>
          <p className="mt-1 text-sm text-stone-600">Write only what is true — e.g. don’t mention a founding year unless you’re sure of it.</p>
        </div>
        <Field label="Introduction" htmlFor="about_intro" error={fe.about_intro} hint="Leave blank to use the short standard introduction.">
          <TextArea id="about_intro" name="about_intro" rows={4} defaultValue={v('about_intro')} maxLength={2000} />
        </Field>
        <Field label="Our story / history" htmlFor="about_history" error={fe.about_history} hint="Hidden on the website until filled in.">
          <TextArea id="about_history" name="about_history" rows={6} defaultValue={v('about_history')} maxLength={5000} />
        </Field>
      </section>

      <div className="sticky bottom-20 z-30 -mx-4 border-t border-graphite-900/10 bg-ivory-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <SubmitButton pending={pending} className="w-full sm:w-auto">
          Save business details
        </SubmitButton>
      </div>
    </form>
  );
}
