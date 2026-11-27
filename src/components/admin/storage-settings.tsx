'use client';

import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { retryImageCleanup, saveDefaultImageProvider, type ActionState } from '@/app/admin/(panel)/actions';
import { PROVIDER_LABEL, PROVIDER_LIMITS, type ImageProvider } from '@/lib/image-providers';
import type { ProviderStatus } from '@/lib/imagekit';
import { Button } from '@/components/ui/button';
import { FormAlert, SubmitButton } from './form';
import { ProviderPicker } from './provider-picker';

type Props = {
  current: ImageProvider;
  statuses: ProviderStatus[];
  imagekitUsage: string | null;
  supabaseUsage: string | null;
  imagekitConfigGaps: string[];
  pendingCleanups: number;
};

/**
 * Image Storage Settings: which provider new photos go to, whether each
 * provider is actually reachable, what the upload limits are, and any files
 * still waiting to be cleaned up. No key material is ever displayed.
 */
export function StorageSettings({
  current,
  statuses,
  imagekitUsage,
  supabaseUsage,
  imagekitConfigGaps,
  pendingCleanups,
}: Props) {
  const [saveState, saveAction, saving] = useActionState<ActionState, FormData>(saveDefaultImageProvider, null);
  const [cleanupState, cleanupAction, cleaning] = useActionState<ActionState, FormData>(retryImageCleanup, null);
  const [choice, setChoice] = useState<ImageProvider>(current);
  const imagekitReady = statuses.some((s) => s.provider === 'imagekit' && s.state === 'ready');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    startTransition(() => saveAction(fd));
  }

  return (
    <section
      aria-labelledby="image-storage-heading"
      className="space-y-5 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6"
      id="image-storage"
    >
      <div>
        <h2 id="image-storage-heading" className="text-lg font-bold uppercase">
          Image storage
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Where new product photos are saved. Photos already uploaded stay exactly where they are and keep working.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <ProviderPicker
          value={choice}
          onChange={setChoice}
          imagekitReady={imagekitReady}
          name="default_image_provider"
          footnote={`Saved default: ${PROVIDER_LABEL[current]}. An admin can still pick the other one for a single upload on the product page.`}
        />
        {saveState?.error && <FormAlert error={saveState.error} />}
        {saveState?.message && <FormAlert message={saveState.message} />}
        <SubmitButton pending={saving} className="w-full sm:w-auto">
          Save default provider
        </SubmitButton>
      </form>

      <div className="space-y-3 border-t border-graphite-900/10 pt-5">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Connection status</h3>
        <ul className="space-y-3" data-testid="provider-statuses">
          {statuses.map((status) => (
            <li key={status.provider} className="rounded-md border border-graphite-900/10 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{PROVIDER_LABEL[status.provider]}</span>
                <StatusPill state={status.state} />
                {status.provider === current && (
                  <span className="rounded bg-ink px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase text-bronze-300">
                    Selected
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-stone-700">{status.detail}</p>
              <p className="mt-1 text-sm text-stone-600">{PROVIDER_LIMITS[status.provider].note}</p>
              <p className="mt-1 text-sm text-stone-600">
                Storage used:{' '}
                {status.provider === 'imagekit'
                  ? (imagekitUsage ?? 'Usage unavailable')
                  : (supabaseUsage ?? 'Usage unavailable')}
              </p>
            </li>
          ))}
        </ul>

        {imagekitConfigGaps.length > 0 && (
          <p className="text-sm text-stone-700">
            To enable ImageKit, set {imagekitConfigGaps.join(' and ')} in the server environment, then reload this page.
            The private key is never shown here and never reaches the browser.
          </p>
        )}
      </div>

      <div className="space-y-3 border-t border-graphite-900/10 pt-5">
        <h3 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-stone-600">Leftover files</h3>
        {pendingCleanups === 0 ? (
          <p className="text-sm text-stone-600" data-testid="cleanup-empty">
            Nothing waiting. Every deleted photo was also removed from its storage provider.
          </p>
        ) : (
          <p className="text-sm font-medium text-bronze-700" data-testid="cleanup-pending">
            {pendingCleanups} file{pendingCleanups === 1 ? '' : 's'} could not be deleted from the storage provider when
            the photo was removed. They are recorded so they can be deleted later.
          </p>
        )}
        {cleanupState?.error && <FormAlert error={cleanupState.error} />}
        {cleanupState?.warning && <p className="text-sm font-medium text-bronze-700">{cleanupState.warning}</p>}
        {cleanupState?.message && <FormAlert message={cleanupState.message} />}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(() => cleanupAction(new FormData(event.currentTarget)));
          }}
        >
          <Button type="submit" variant="outline" size="md" disabled={cleaning || pendingCleanups === 0}>
            {cleaning ? 'Retrying…' : 'Retry cleanup'}
          </Button>
        </form>
      </div>
    </section>
  );
}

function StatusPill({ state }: { state: ProviderStatus['state'] }) {
  const style =
    state === 'ready'
      ? 'bg-ok-50 text-ok-700'
      : state === 'not-configured'
        ? 'bg-ivory-200 text-stone-700'
        : 'bg-stop-50 text-stop-700';
  const label = state === 'ready' ? 'Connected' : state === 'not-configured' ? 'Not configured' : 'Problem';
  return <span className={`rounded px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase ${style}`}>{label}</span>;
}
