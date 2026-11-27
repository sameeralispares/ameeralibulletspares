'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { moveTaxonomy, saveTaxonomy, type ActionState } from '@/app/admin/(panel)/actions';
import { Field, FormAlert, SubmitButton, TextArea, TextInput, submitWithoutReset } from './form';
import { IconChevronDown, IconChevronUp, IconPlus } from '@/components/ui/icons';
import { buttonClasses } from '@/components/ui/button';
import { slugify } from '@/lib/slug';

type Item = { id: string; name: string; slug: string; description: string | null; is_active: boolean; productCount: number };
type Kind = 'models' | 'categories';

function ItemForm({ kind, item, onDone }: { kind: Kind; item?: Item; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await saveTaxonomy(kind, prev, fd);
    if (res?.ok) onDone?.();
    return res;
  }, null);
  const [name, setName] = useState(item?.name ?? '');
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [touched, setTouched] = useState(Boolean(item));
  const fe = state?.fieldErrors ?? {};
  const prefix = item ? `${kind}-${item.id}` : `${kind}-new`;
  const label = kind === 'models' ? 'model' : 'category';

  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-4" noValidate>
      {item && <input type="hidden" name="id" value={item.id} />}
      <FormAlert error={state?.error} message={state?.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${prefix}-name`} required error={fe.name}>
          <TextInput
            id={`${prefix}-name`}
            name="name"
            value={name}
            maxLength={80}
            invalid={Boolean(fe.name)}
            onChange={(e) => {
              setName(e.target.value);
              if (!touched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field
          label="URL name"
          htmlFor={`${prefix}-slug`}
          required
          error={fe.slug}
          hint={kind === 'models' ? `Page: /models/${slug || '…'}` : `Filter: /products?category=${slug || '…'}`}
        >
          <TextInput
            id={`${prefix}-slug`}
            name="slug"
            value={slug}
            maxLength={120}
            className="font-mono"
            invalid={Boolean(fe.slug)}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </Field>
      </div>
      <Field label="Short description" htmlFor={`${prefix}-desc`} error={fe.description} hint={kind === 'models' ? 'Shown at the top of the model page. Leave blank for the standard text.' : undefined}>
        <TextArea id={`${prefix}-desc`} name="description" rows={2} maxLength={600} defaultValue={item?.description ?? ''} className="min-h-20" />
      </Field>
      <label className="flex min-h-12 cursor-pointer items-center gap-3">
        <input type="checkbox" name="is_active" defaultChecked={item?.is_active ?? true} className="h-5 w-5 accent-[var(--color-graphite-900)]" />
        <span className="font-medium">Active (shown on the website)</span>
      </label>
      <SubmitButton pending={pending} className="w-full sm:w-auto">
        {item ? 'Save' : `Add ${label}`}
      </SubmitButton>
    </form>
  );
}

export function TaxonomyManager({ kind, items }: { kind: Kind; items: Item[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const label = kind === 'models' ? 'model' : 'category';

  function move(id: string, dir: 'up' | 'down') {
    start(async () => {
      await moveTaxonomy(kind, id, dir);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4" data-testid="taxonomy-manager">
      {adding ? (
        <div className="rounded-[var(--radius-plate)] border border-bronze-500 bg-white p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold uppercase">New {label}</h2>
            <button type="button" onClick={() => setAdding(false)} className="min-h-11 px-2 text-sm font-semibold text-stone-600">
              Cancel
            </button>
          </div>
          <ItemForm
            kind={kind}
            onDone={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={buttonClasses('primary', 'md', 'w-full sm:w-auto')}>
          <IconPlus /> Add {label}
        </button>
      )}

      <ol className="divide-y divide-graphite-900/10 overflow-hidden rounded-[var(--radius-plate)] border border-graphite-900/10 bg-white" aria-busy={pending}>
        {items.map((item, i) => (
          <li key={item.id} className="p-4">
            <div className="flex items-center gap-3">
              <span className="w-6 shrink-0 font-mono text-xs text-stone-500">{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <p className={`font-semibold ${item.is_active ? '' : 'text-stone-500 line-through decoration-1'}`}>{item.name}</p>
                <p className="text-xs text-stone-600">
                  {item.is_active ? 'Active' : 'Inactive — hidden from website'} · {item.productCount} product{item.productCount === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={() => move(item.id, 'up')} disabled={i === 0 || pending} aria-label={`Move ${item.name} up`} className="grid h-11 w-11 place-items-center rounded border border-graphite-900/15 disabled:opacity-40">
                <IconChevronUp />
              </button>
              <button type="button" onClick={() => move(item.id, 'down')} disabled={i === items.length - 1 || pending} aria-label={`Move ${item.name} down`} className="grid h-11 w-11 place-items-center rounded border border-graphite-900/15 disabled:opacity-40">
                <IconChevronDown />
              </button>
              <button
                type="button"
                onClick={() => setEditing(editing === item.id ? null : item.id)}
                aria-expanded={editing === item.id}
                className="min-h-11 rounded border border-graphite-900/15 px-3 text-sm font-semibold hover:border-graphite-900"
              >
                {editing === item.id ? 'Close' : 'Edit'}
              </button>
            </div>
            {editing === item.id && (
              <div className="mt-4 border-t border-graphite-900/10 pt-4">
                <ItemForm
                  kind={kind}
                  item={item}
                  onDone={() => {
                    router.refresh();
                  }}
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
