'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { importProducts, type ImportResult } from '@/app/admin/(panel)/actions';
import { FormAlert, SubmitButton, submitWithoutReset } from './form';

const badge = {
  created: 'bg-ok-50 text-ok-700',
  skipped: 'bg-ivory-200 text-graphite-700',
  error: 'bg-stop-50 text-stop-700',
};

export function ImportForm() {
  const [state, action, pending] = useActionState<ImportResult, FormData>(importProducts, null);
  return (
    <div className="space-y-6">
      <form onSubmit={submitWithoutReset(action)} className="space-y-4 rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white p-4 sm:p-6">
        <FormAlert error={state?.error} message={state?.created !== undefined ? `${state.created} product${state.created === 1 ? '' : 's'} added.` : undefined} />
        <div>
          <label htmlFor="file" className="mb-1.5 block text-sm font-semibold">CSV file <span className="text-stop-700">*</span></label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="block w-full rounded-md border border-graphite-900/20 bg-white p-2.5 text-sm file:mr-3 file:min-h-10 file:rounded file:border-0 file:bg-graphite-900 file:px-4 file:font-semibold file:text-ivory-50"
          />
          <p className="mt-1.5 text-sm text-stone-600">Up to 500 rows, 1 MB. Existing part numbers are skipped, never overwritten.</p>
        </div>
        <SubmitButton pending={pending} pendingLabel="Importing…" className="w-full sm:w-auto">Import products</SubmitButton>
      </form>

      {state?.results && state.results.length > 0 && (
        <section aria-labelledby="results-h" className="rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white">
          <h2 id="results-h" className="border-b border-graphite-900/10 p-4 text-lg font-bold uppercase">Results</h2>
          <ul className="divide-y divide-graphite-900/10">
            {state.results.map((r) => (
              <li key={`${r.line}-${r.name}`} className="flex flex-wrap items-start gap-x-3 gap-y-1 p-3 text-sm">
                <span className="w-14 shrink-0 font-mono text-xs text-stone-500">Row {r.line}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${badge[r.outcome]}`}>{r.outcome}</span>
                <span className="min-w-0 flex-1 font-medium">{r.name}</span>
                {r.note && <span className="w-full pl-[4.25rem] text-xs text-stone-600">{r.note}</span>}
              </li>
            ))}
          </ul>
          <p className="border-t border-graphite-900/10 p-4 text-sm">
            <Link href="/admin/products" className="font-semibold text-bronze-700 underline underline-offset-4">Go to products</Link> to add photos and check details.
          </p>
        </section>
      )}
    </div>
  );
}
