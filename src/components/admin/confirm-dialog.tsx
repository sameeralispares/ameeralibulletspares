'use client';

import { useId, useRef, type ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/button';

/**
 * Accessible confirmation using the native <dialog> element (focus trapping,
 * Escape to close and backdrop come from the browser). Used before every
 * destructive action.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  onConfirm,
  triggerLabel,
  triggerAriaLabel,
  triggerClassName,
}: {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  triggerLabel: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        aria-label={triggerAriaLabel}
        className={triggerClassName ?? buttonClasses('danger', 'md')}
        onClick={() => ref.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-ivory-50 p-0 text-ink shadow-2xl backdrop:bg-ink/60"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="p-6">
          <h2 id={titleId} className="text-xl font-bold uppercase">
            {title}
          </h2>
          <div className="mt-2 text-[0.9375rem] text-stone-600">{description}</div>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" autoFocus className={buttonClasses('outline', 'md')} onClick={() => ref.current?.close()}>
              Cancel
            </button>
            <button
              type="button"
              className={buttonClasses('danger', 'md')}
              onClick={() => {
                ref.current?.close();
                onConfirm();
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
