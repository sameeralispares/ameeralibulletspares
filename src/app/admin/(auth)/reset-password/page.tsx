import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerSupabase } from '@/lib/supabase/server';
import { ResetPasswordForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Choose a new password' };

async function ResetContent() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return (
      <p className="text-stone-600">
        This reset link has expired or was already used.{' '}
        <Link href="/admin/forgot-password" className="font-semibold text-bronze-700 underline underline-offset-4">
          Request a new link
        </Link>
        .
      </p>
    );
  }
  return <ResetPasswordForm />;
}

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-[2rem] font-bold uppercase">Choose a new password</h1>
      <p className="mb-6 mt-1 text-stone-600">You&apos;ll be signed in once it&apos;s saved.</p>
      <Suspense fallback={<div className="h-56" />}>
        <ResetContent />
      </Suspense>
    </>
  );
}
