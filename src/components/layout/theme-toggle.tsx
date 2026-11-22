'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'aurevyn-theme';

/**
 * Light / dark switch.
 *
 * Dark is the shipped default (it is the brand's canvas). The choice is stored
 * locally and applied by the inline script in the root layout BEFORE first
 * paint, so switching themes never flashes the wrong canvas. The light theme is
 * an additive CSS layer in globals.css (`[data-theme='light']`) - the default
 * rendering is untouched.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the toggle still works for
      // this page view.
    }
  }

  const isLight = theme === 'light';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isLight}
      aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
      title={isLight ? 'Dark mode' : 'Light mode'}
      className={cn(
        'btn-press flex h-10 w-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-white/[0.06] hover:text-ink-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60',
        className
      )}
    >
      {mounted && isLight ? (
        <svg
          className="h-5 w-5 sm:h-[22px] sm:w-[22px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5 sm:h-[22px] sm:w-[22px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.2" />
          <path
            strokeLinecap="round"
            d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"
          />
        </svg>
      )}
    </button>
  );
}
