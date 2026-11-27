'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { safeAdminPath } from '@/lib/auth';
import { SITE_URL } from '@/lib/site';

export type FormState = { error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(200),
  next: z.string().optional(),
});

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    // Same message for unknown email and wrong password (no account enumeration).
    if (error.status === 429) return { error: 'Too many attempts. Please wait a few minutes and try again.' };
    return { error: 'Incorrect email or password.' };
  }

  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) {
    await supabase.auth.signOut();
    return { error: 'This account does not have access to the admin panel.' };
  }

  redirect(safeAdminPath(parsed.data.next));
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/admin/login?signed_out=1');
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().email('Enter a valid email address') });

export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/auth/confirm?next=/admin/reset-password`,
  });
  if (error?.status === 429) {
    return { error: 'Too many requests. Please wait a few minutes before trying again.' };
  }
  if (error) console.error('[auth] reset request failed:', error.message);
  // Always the same response, whether or not the account exists.
  return {
    message: 'If that email belongs to an admin account, a password reset link has been sent. Check your inbox (and spam folder).',
  };
}

const passwordSchema = z
  .object({
    password: z.string().min(12, 'Use at least 12 characters').max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: 'The two passwords do not match', path: ['confirm'] });

export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordSchema.safeParse({ password: formData.get('password'), confirm: formData.get('confirm') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const supabase = await createServerSupabase();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { error: 'Your reset link has expired. Please request a new one.' };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { error: error.message.includes('different') ? 'Choose a password you have not used before.' : 'Could not update the password. Please try again.' };
  }
  redirect('/admin?password_updated=1');
}
