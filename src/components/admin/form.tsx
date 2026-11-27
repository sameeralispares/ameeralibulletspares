'use client';

import { useFormStatus } from 'react-dom';
import { startTransition, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import { buttonClasses } from '@/components/ui/button';
import { IconAlert, IconCheck } from '@/components/ui/icons';

export const inputCls =
  'block min-h-12 w-full rounded-md border border-graphite-900/20 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-stone-500 focus:border-bronze-500 focus:outline-none focus:ring-2 focus:ring-bronze-500/25 aria-[invalid=true]:border-stop-700 disabled:bg-ivory-100';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required ? <span className="text-stop-700"> *</span> : <span className="font-normal text-stone-500"> (optional)</span>}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-sm text-stone-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-sm font-medium text-stop-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid, describedBy, className = '', ...props }: ComponentProps<'input'> & { invalid?: boolean; describedBy?: string }) {
  return <input {...props} className={`${inputCls} ${className}`} aria-invalid={invalid || undefined} aria-describedby={describedBy} />;
}

export function TextArea({ invalid, className = '', ...props }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea {...props} className={`${inputCls} ${className.includes('min-h-') ? '' : 'min-h-32'} leading-relaxed ${className}`} aria-invalid={invalid || undefined} />;
}

export function SelectInput({ invalid, className = '', ...props }: ComponentProps<'select'> & { invalid?: boolean }) {
  return <select {...props} className={`${inputCls} ${className}`} aria-invalid={invalid || undefined} />;
}

export function SubmitButton({
  children,
  pendingLabel = 'Saving…',
  variant = 'primary',
  className = '',
  pending: pendingProp,
  ...rest
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'dark' | 'danger' | 'outline';
  className?: string;
  pending?: boolean;
} & Omit<ComponentProps<'button'>, 'type' | 'children' | 'className'>) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending || rest.disabled} aria-busy={pending} className={buttonClasses(variant, 'md', className)} {...rest}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null;
  const isError = Boolean(error);
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex gap-3 rounded-md px-4 py-3 text-[0.9375rem] ${
        isError ? 'bg-stop-50 text-stop-700 ring-1 ring-stop-700/20' : 'bg-ok-50 text-ok-700 ring-1 ring-ok-700/20'
      }`}
    >
      {isError ? <IconAlert className="mt-0.5 shrink-0" /> : <IconCheck className="mt-0.5 shrink-0" />}
      <span>{error ?? message}</span>
    </div>
  );
}

/**
 * Submit a form to a useActionState action WITHOUT React's automatic form
 * reset, so the owner's typing is kept when validation fails.
 */
export function submitWithoutReset(dispatch: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
}
