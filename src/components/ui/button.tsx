import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

type Variant = 'primary' | 'dark' | 'outline' | 'outline-light' | 'ghost' | 'danger' | 'whatsapp';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-plate)] font-display font-semibold uppercase tracking-[0.08em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55 select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-bronze-500 text-ink hover:bg-bronze-400 active:bg-bronze-600',
  dark: 'bg-graphite-900 text-ivory-50 hover:bg-graphite-800 active:bg-ink',
  outline: 'border border-graphite-900/25 bg-transparent text-ink hover:border-graphite-900 hover:bg-ivory-100',
  'outline-light': 'border border-ivory-50/35 bg-transparent text-ivory-50 hover:border-ivory-50 hover:bg-white/5',
  ghost: 'bg-transparent text-ink hover:bg-ivory-200/70',
  danger: 'bg-stop-700 text-white hover:bg-[#7e2622]',
  whatsapp: 'bg-[#1f6e43] text-white hover:bg-[#185a36] active:bg-[#134a2c]',
};

// Every size keeps a touch target of at least 44px tall.
const sizes: Record<Size, string> = {
  sm: 'min-h-11 px-3.5 text-[0.8125rem]',
  md: 'min-h-12 px-5 text-[0.9375rem]',
  lg: 'min-h-14 px-6 text-base',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

type ButtonProps = ComponentProps<'button'> & { variant?: Variant; size?: Size };

export function Button({ variant = 'primary', size = 'md', className = '', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type LinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children: ReactNode };

export function ButtonLink({ variant = 'primary', size = 'md', className = '', ...props }: LinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}

type AnchorProps = ComponentProps<'a'> & { variant?: Variant; size?: Size };

/** External links (tel:, wa.me, maps). */
export function ButtonAnchor({ variant = 'primary', size = 'md', className = '', ...props }: AnchorProps) {
  return <a className={buttonClasses(variant, size, className)} {...props} />;
}
