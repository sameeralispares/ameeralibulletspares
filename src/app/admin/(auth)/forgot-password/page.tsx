import type { Metadata } from 'next';
import { ForgotPasswordForm } from '../auth-forms';

export const metadata: Metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-[2rem] font-bold uppercase">Reset password</h1>
      <p className="mb-6 mt-1 text-stone-600">Enter your admin email and we&apos;ll send you a link to choose a new password.</p>
      <ForgotPasswordForm />
    </>
  );
}
