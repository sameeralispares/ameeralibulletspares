import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · S Ameer Ali' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
