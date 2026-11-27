'use client';

import { useActionState, useState } from 'react';
import { saveProduct, type ActionState } from '@/app/admin/(panel)/actions';
import { PART_TYPE_ADMIN_HINT, PART_TYPE_LONG_LABEL, PART_TYPES, type PartType } from '@/lib/part-types';
import { Field, FormAlert, SelectInput, SubmitButton, TextArea, TextInput, submitWithoutReset } from './form';
import { slugify } from '@/lib/slug';
import { AVAILABILITY_OPTIONS, STATUS_OPTIONS, type Availability, type ProductStatus } from '@/lib/types';

export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  part_number: string | null;
  mrp: number | null;
  offer_price: number | null;
  vendor_mrp: number | null;
  vendor_offer_price: number | null;
  description: string | null;
  category_id: string | null;
  availability: Availability;
  status: ProductStatus;
  is_featured: boolean;
  part_type: PartType;
  seo_title: string | null;
  seo_description: string | null;
  model_ids: string[];
};

type Option = { id: string; name: string; is_active: boolean };

export function ProductForm({
  initial,
  models,
  categories,
}: {
  initial: ProductFormValues;
  models: Option[];
  categories: Option[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveProduct, null);
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.id));
  // Drives the extra vendor price fields below.
  const [partType, setPartType] = useState<PartType>(initial.part_type);
  const fe = state?.fieldErrors ?? {};
  const isNew = !initial.id;

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-6" noValidate>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <FormAlert error={state?.error} message={state?.message} />

      <section className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-bold uppercase">Part details</h2>
        <Field label="Part name" htmlFor="name" required error={fe.name} hint="As customers would search for it, e.g. “Clutch plate set”.">
          <TextInput
            id="name"
            name="name"
            required
            maxLength={140}
            value={name}
            invalid={Boolean(fe.name)}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <fieldset className="rounded-md border border-graphite-900/15 p-4">
          <legend className="px-1 font-display text-sm font-semibold uppercase tracking-[0.08em]">
            Where this stock came from <span className="text-stop-700">*</span>
          </legend>
          <p className="mb-3 text-sm text-stone-600">
            Every part here is a genuine Royal Enfield part. This records which supply the shop buys it through, so you
            can see which one sells more. Choose <strong>Both</strong> when you hold the same part from both supplies:
            you then enter a price for each, and the customer picks which one they want.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-4" data-testid="part-type-choice">
            {PART_TYPES.map((value) => (
              <label
                key={value}
                className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-md border border-graphite-900/15 px-3 hover:bg-ivory-100"
              >
                <input
                  type="radio"
                  name="part_type"
                  value={value}
                  checked={partType === value}
                  onChange={() => setPartType(value)}
                  className="h-5 w-5 accent-[var(--color-graphite-900)]"
                />
                <span>
                  <span className="font-semibold">{PART_TYPE_LONG_LABEL[value]}</span>
                  <span className="block text-xs text-stone-600">{PART_TYPE_ADMIN_HINT[value]}</span>
                </span>
              </label>
            ))}
          </div>
          {fe.part_type && <p className="mt-1.5 text-sm font-medium text-stop-700">{fe.part_type}</p>}
        </fieldset>

        <Field
          label="Part number"
          htmlFor="part_number"
          error={fe.part_number}
          hint="The Royal Enfield part number, or the number the vendor uses."
        >
          <TextInput id="part_number" name="part_number" maxLength={60} defaultValue={initial.part_number ?? ''} className="font-mono" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label={partType === 'both' ? 'OEM MRP (₹)' : 'MRP (₹)'}
            htmlFor="mrp"
            error={fe.mrp}
            hint="The printed price in rupees, e.g. 1250. Leave blank if not known — the site then says “Price on enquiry”."
          >
            <TextInput id="mrp" name="mrp" inputMode="decimal" maxLength={12} defaultValue={initial.mrp ?? ''} placeholder="e.g. 1250" />
          </Field>
          <Field
            label={partType === 'both' ? 'OEM offer price (₹)' : 'Offer price (₹)'}
            htmlFor="offer_price"
            error={fe.offer_price}
            hint="Optional. A special price for this part only. It overrides any festive discount."
          >
            <TextInput id="offer_price" name="offer_price" inputMode="decimal" maxLength={12} defaultValue={initial.offer_price ?? ''} placeholder="Optional" />
          </Field>
        </div>

        {partType === 'both' && (
          <div className="rounded-md border border-graphite-900/15 bg-ivory-100/60 p-4" data-testid="vendor-prices">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.08em]">Vendor price</p>
            <p className="mt-1 text-sm text-stone-600">
              What the same part costs from the vendor supply. The customer sees both prices and chooses.
            </p>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <Field label="Vendor MRP (₹)" htmlFor="vendor_mrp" error={fe.vendor_mrp} hint="Leave blank for “Price on enquiry” on the vendor option.">
                <TextInput
                  id="vendor_mrp"
                  name="vendor_mrp"
                  inputMode="decimal"
                  maxLength={12}
                  defaultValue={initial.vendor_mrp ?? ''}
                  placeholder="e.g. 980"
                />
              </Field>
              <Field label="Vendor offer price (₹)" htmlFor="vendor_offer_price" error={fe.vendor_offer_price} hint="Optional.">
                <TextInput
                  id="vendor_offer_price"
                  name="vendor_offer_price"
                  inputMode="decimal"
                  maxLength={12}
                  defaultValue={initial.vendor_offer_price ?? ''}
                  placeholder="Optional"
                />
              </Field>
            </div>
          </div>
        )}
        <Field label="Category" htmlFor="category_id" error={fe.category_id}>
          <SelectInput id="category_id" name="category_id" defaultValue={initial.category_id ?? ''}>
            <option value="">— No category —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Description" htmlFor="description" error={fe.description} hint="Plain facts only — what the part is and any fitting notes you are sure of.">
          <TextArea id="description" name="description" maxLength={5000} rows={5} defaultValue={initial.description ?? ''} />
        </Field>
      </section>

      <section className="space-y-4 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <div>
          <h2 className="text-lg font-bold uppercase">Fits these motorcycles</h2>
          <p className="mt-1 text-sm text-stone-600">Tick every model this part is confirmed to fit.</p>
        </div>
        <fieldset>
          <legend className="sr-only">Compatible models</legend>
          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
            {models.map((m) => (
              <label
                key={m.id}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-graphite-900/15 px-3 has-[:checked]:border-ink has-[:checked]:bg-ivory-100 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-bronze-500"
              >
                <input
                  type="checkbox"
                  name="model_ids"
                  value={m.id}
                  defaultChecked={initial.model_ids.includes(m.id)}
                  className="h-5 w-5 accent-[var(--color-graphite-900)]"
                />
                <span className="text-[0.9375rem] font-medium">
                  {m.name}
                  {!m.is_active && <span className="ml-1 text-xs text-stone-500">(inactive)</span>}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-bold uppercase">Availability &amp; visibility</h2>
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">
            Availability <span className="text-stop-700">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {AVAILABILITY_OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-graphite-900/15 px-3 has-[:checked]:border-ink has-[:checked]:bg-ivory-100"
              >
                <input type="radio" name="availability" value={o.value} defaultChecked={initial.availability === o.value} className="h-5 w-5 accent-[var(--color-graphite-900)]" />
                <span className="font-medium">{o.label}</span>
              </label>
            ))}
          </div>
          {fe.availability && <p className="mt-1.5 text-sm font-medium text-stop-700">{fe.availability}</p>}
        </fieldset>

        <Field label="Status" htmlFor="status" required error={fe.status}>
          <SelectInput id="status" name="status" defaultValue={initial.status}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label} — {o.hint}
              </option>
            ))}
          </SelectInput>
        </Field>

        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md border border-graphite-900/15 px-3 has-[:checked]:border-bronze-500 has-[:checked]:bg-bronze-300/20">
          <input type="checkbox" name="is_featured" defaultChecked={initial.is_featured} className="h-5 w-5 accent-[var(--color-bronze-600)]" />
          <span>
            <span className="block font-medium">Feature on the homepage</span>
            <span className="text-sm text-stone-600">Shown in “Featured parts” when published.</span>
          </span>
        </label>
      </section>

      <details className="group rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6" open={Boolean(fe.slug || fe.seo_title || fe.seo_description)}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-lg font-bold uppercase [&::-webkit-details-marker]:hidden">
          Web address &amp; Google listing
          <span className="text-sm font-normal normal-case text-stone-500 group-open:hidden">Optional — show</span>
        </summary>
        <div className="mt-4 space-y-5">
          <Field
            label="URL name"
            htmlFor="slug"
            required
            error={fe.slug}
            hint={
              <>
                Page address: <span className="font-mono">/products/{slug || '…'}</span>. Changing this later breaks old links.
              </>
            }
          >
            <TextInput
              id="slug"
              name="slug"
              value={slug}
              maxLength={120}
              invalid={Boolean(fe.slug)}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value.toLowerCase());
              }}
              className="font-mono"
            />
          </Field>
          <Field label="Google title" htmlFor="seo_title" error={fe.seo_title} hint="Up to 70 characters. Leave blank to use the part name automatically.">
            <TextInput id="seo_title" name="seo_title" maxLength={70} defaultValue={initial.seo_title ?? ''} />
          </Field>
          <Field label="Google description" htmlFor="seo_description" error={fe.seo_description} hint="Up to 170 characters. Leave blank to generate one from the part details.">
            <TextArea id="seo_description" name="seo_description" maxLength={170} rows={3} defaultValue={initial.seo_description ?? ''} />
          </Field>
        </div>
      </details>

      <div className="sticky bottom-20 z-30 -mx-4 border-t border-graphite-900/10 bg-ivory-50/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0">
        <SubmitButton pending={pending} className="w-full sm:w-auto">{isNew ? 'Create product' : 'Save changes'}</SubmitButton>
        {isNew && <p className="mt-2 text-sm text-stone-600">You can add photos after creating the product.</p>}
      </div>
    </form>
  );
}
