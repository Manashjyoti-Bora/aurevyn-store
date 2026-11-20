import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes, ReactNode, AnchorHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const base =
  'btn-press inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-medium tracking-[0.01em] transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary:
    'btn-sheen bg-brand-700 text-cream-50 shadow-soft hover:bg-brand-500 active:bg-brand-400',
  secondary:
    'border border-white/[0.12] bg-cream-100 text-ink-900 hover:border-accent-400/40 hover:bg-cream-200',
  outline:
    'border border-white/[0.16] bg-transparent text-ink-800 hover:border-accent-400/55 hover:text-ink-950',
  ghost: 'text-ink-400 hover:bg-white/[0.05] hover:text-ink-900',
  danger: 'bg-danger-600 text-cream-50 shadow-soft hover:bg-danger-700',
  success: 'bg-success-600 text-cream-50 shadow-soft hover:bg-success-700',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[11px] uppercase tracking-[0.14em]',
  md: 'px-5 py-2.5 text-[11px] uppercase tracking-[0.14em]',
  lg: 'px-7 py-3 text-[12px] uppercase tracking-[0.16em]',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cn(base, variants[variant], sizes[size], className)} {...props}>
      {children}
    </a>
  );
}

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
