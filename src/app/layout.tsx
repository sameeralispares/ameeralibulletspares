import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SITE_URL } from '@/lib/site';
import './globals.css';

const body = localFont({
  src: [
    { path: './fonts/barlow-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/barlow-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/barlow-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
});

const display = localFont({
  src: [
    { path: './fonts/barlow-condensed-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/barlow-condensed-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/barlow-condensed-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-display-face',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Genuine Royal Enfield Spare Parts in Chennai | S Ameer Ali, Pudupet',
    template: '%s | S Ameer Ali Bullet Spare Parts',
  },
  description:
    'S Ameer Ali Bullet Spare Parts, Venkatachalan Naicken Street, Pudupet, Chennai — genuine Royal Enfield spare parts for Bullet, Classic, Electra, Thunderbird and newer models. Check availability by phone.',
  applicationName: 'S Ameer Ali Bullet Spare Parts',
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'S Ameer Ali Bullet Spare Parts',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  themeColor: '#17181b',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" className={`${body.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
