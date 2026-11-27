'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { quickUpdateProduct } from '@/app/admin/(panel)/actions';
import { AVAILABILITY_OPTIONS, type Availability } from '@/lib/types';
import { IconStar } from '@/components/ui/icons';

/** One-tap availability change from the product list. */
export function AvailabilityQuickSelect({ id, value, name }: { id: string; value: Availability; name: string }) {
  const [current, setCurrent] = useState(value);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div>
      <label htmlFor={`avail-${id}`} className="sr-only">
        Availability for {name}
      </label>
      <select
        id={`avail-${id}`}
        value={current}
        disabled={pending}
        aria-busy={pending}
        onChange={(e) => {
          const next = e.target.value as Availability;
          const prev = current;
          setCurrent(next);
          setError(null);
          const fd = new FormData();
          fd.set('id', id);
          fd.set('field', 'availability');
          fd.set('value', next);
          start(async () => {
            const res = await quickUpdateProduct(fd);
            if (res?.error) {
              setCurrent(prev);
              setError(res.error);
            } else router.refresh();
          });
        }}
        className={`min-h-11 w-full rounded-md border px-2.5 text-sm font-medium focus:border-bronze-500 focus:outline-none sm:w-48 ${
          current === 'available'
            ? 'border-ok-700/30 bg-ok-50 text-ok-700'
            : current === 'out_of_stock'
              ? 'border-stop-700/30 bg-stop-50 text-stop-700'
              : 'border-ask-700/30 bg-ask-50 text-ask-700'
        }`}
      >
        {AVAILABILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {pending && <p className="mt-1 text-xs text-stone-500">Saving…</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-stop-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function FeaturedToggle({ id, value, name }: { id: string; value: boolean; name: string }) {
  const [on, setOn] = useState(value);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from featured` : `Feature ${name} on the homepage`}
      title={on ? 'Featured on homepage' : 'Not featured'}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        const fd = new FormData();
        fd.set('id', id);
        fd.set('field', 'is_featured');
        fd.set('value', String(next));
        start(async () => {
          const res = await quickUpdateProduct(fd);
          if (res?.error) setOn(!next);
          else router.refresh();
        });
      }}
      className={`grid h-11 w-11 place-items-center rounded-md border ${
        on ? 'border-bronze-500 bg-bronze-300/40 text-bronze-700' : 'border-graphite-900/15 text-stone-500 hover:border-graphite-900'
      }`}
    >
      <IconStar fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
