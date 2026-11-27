'use client';

import {
  IMAGE_PROVIDERS,
  PROVIDER_BLURB,
  PROVIDER_LABEL,
  PROVIDER_LIMITS,
  type ImageProvider,
} from '@/lib/image-providers';

type Props = {
  value: ImageProvider;
  onChange: (provider: ImageProvider) => void;
  /** False when the ImageKit keys are not set on the server. */
  imagekitReady: boolean;
  /** Shown under the picker, e.g. which provider is saved as the default. */
  footnote?: string;
  name?: string;
  disabled?: boolean;
};

/**
 * Segmented control for choosing where the next photo is stored. Built from
 * real radio inputs, so it works with a keyboard and screen readers; the
 * inputs are visually hidden and the labels are the segments.
 */
export function ProviderPicker({ value, onChange, imagekitReady, footnote, name = 'provider', disabled = false }: Props) {
  return (
    <div className="space-y-2">
      <fieldset disabled={disabled}>
        <legend className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">
          Store new photos on
        </legend>
        <div
          className="mt-2 inline-flex w-full rounded-[var(--radius-plate)] border border-graphite-900/20 bg-ivory-100 p-1 sm:w-auto"
          data-testid="provider-picker"
        >
          {IMAGE_PROVIDERS.map((provider) => {
            const selected = provider === value;
            return (
              <label
                key={provider}
                className={`relative flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors sm:flex-none ${
                  selected ? 'bg-ink text-bronze-300 shadow-sm' : 'text-stone-700 hover:bg-white'
                } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                {/* The input covers the whole segment and is transparent, so
                    the clickable area is the segment itself. */}
                <input
                  type="radio"
                  name={name}
                  value={provider}
                  checked={selected}
                  onChange={() => onChange(provider)}
                  className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
                />
                <span className="pointer-events-none">{PROVIDER_LABEL[provider]}</span>
                {provider === 'imagekit' && !imagekitReady && (
                  <span className="pointer-events-none rounded bg-stop-50 px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase text-stop-700">
                    Not set up
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <p className="text-sm text-stone-600" aria-live="polite">
        {PROVIDER_BLURB[value]} {PROVIDER_LIMITS[value].note}
      </p>

      {value === 'imagekit' && !imagekitReady && (
        <p role="alert" className="text-sm font-medium text-stop-700">
          ImageKit is not configured on the server, so an upload to it will fail. Choose Supabase Storage, or ask for the
          ImageKit keys to be added.
        </p>
      )}

      {footnote && <p className="text-xs text-stone-500">{footnote}</p>}
    </div>
  );
}
