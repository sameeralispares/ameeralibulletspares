'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteProduct, quickUpdateProduct } from '@/app/admin/(panel)/actions';
import { ConfirmButton } from './confirm-dialog';
import { buttonClasses } from '@/components/ui/button';

export function ProductDangerZone({ id, name, status }: { id: string; name: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function setStatus(value: string) {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('field', 'status');
    fd.set('value', value);
    start(async () => {
      const res = await quickUpdateProduct(fd);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <section aria-labelledby="danger-heading" className="space-y-4 rounded-[var(--radius-plate)] border border-stop-700/25 bg-white p-4 sm:p-6">
      <h2 id="danger-heading" className="text-lg font-bold uppercase">Remove from website</h2>
      {error && <p role="alert" className="text-sm font-medium text-stop-700">{error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {status === 'archived' ? (
          <button type="button" disabled={pending} onClick={() => setStatus('draft')} className={buttonClasses('outline', 'md')}>
            Restore as draft
          </button>
        ) : (
          <ConfirmButton
            title="Archive this product?"
            description={<>“{name}” will be removed from the website but kept here for your records. You can restore it later.</>}
            confirmLabel="Archive"
            onConfirm={() => setStatus('archived')}
            triggerLabel="Archive"
            triggerClassName={buttonClasses('outline', 'md')}
          />
        )}
        <ConfirmButton
          title="Delete permanently?"
          description={<>“{name}” and all its photos will be deleted. This cannot be undone. Consider archiving instead.</>}
          confirmLabel="Delete forever"
          onConfirm={() => {
            const fd = new FormData();
            fd.set('id', id);
            start(async () => {
              const res = await deleteProduct(fd);
              if (res?.error) setError(res.error);
            });
          }}
          triggerLabel="Delete permanently"
        />
      </div>
    </section>
  );
}
