import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LoginForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Sign in' };

const NOTICES: Record<string, { error?: string; message?: string }> = {
  not_authorised: { error: 'This account does not have access to the admin panel.' },
  link_invalid: { error: 'That link is invalid or has expired. Please request a new password reset.' },
};

async function LoginContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const err = typeof sp.error === 'string' ? NOTICES[sp.error] : undefined;
  const notice = err ?? (sp.signed_out ? { message: 'You have signed out.' } : undefined);
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  return <LoginForm next={next} notice={notice} />;
}

export default function LoginPage(props: PageProps<'/admin/login'>) {
  return (
    <>
      <h1 className="text-[2rem] font-bold uppercase">Admin sign in</h1>
      <p className="mb-6 mt-1 text-stone-600">Manage products, photos and availability.</p>
      <Suspense fallback={<div className="h-72" />}>
        <LoginContent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
