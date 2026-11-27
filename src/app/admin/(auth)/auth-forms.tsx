'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Field, FormAlert, SubmitButton, TextInput, submitWithoutReset } from '@/components/admin/form';
import { requestPasswordReset, signIn, updatePassword, type FormState } from './actions';

export function LoginForm({ next, notice }: { next?: string; notice?: { error?: string; message?: string } }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5" noValidate>
      <FormAlert error={state?.error ?? notice?.error} message={state?.error ? undefined : notice?.message} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Email" htmlFor="email" required>
        <TextInput id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password" required>
        <TextInput id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingLabel="Signing in…">
        Sign in
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/admin/forgot-password" className="font-semibold text-bronze-700 underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5" noValidate>
      <FormAlert error={state?.error} message={state?.message} />
      <Field label="Admin email" htmlFor="email" required>
        <TextInput id="email" name="email" type="email" autoComplete="username" inputMode="email" required autoFocus />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm">
        <Link href="/admin/login" className="font-semibold text-bronze-700 underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, null);
  return (
    <form onSubmit={submitWithoutReset(action)} className="space-y-5" noValidate>
      <FormAlert error={state?.error} />
      <Field label="New password" htmlFor="password" hint="At least 12 characters." required>
        <TextInput id="password" name="password" type="password" autoComplete="new-password" minLength={12} required autoFocus />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required>
        <TextInput id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <SubmitButton pending={pending} className="w-full" pendingLabel="Updating…">
        Set new password
      </SubmitButton>
    </form>
  );
}
