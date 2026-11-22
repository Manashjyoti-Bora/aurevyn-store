'use client';

import Link from 'next/link';
import { AccountMenu } from './account-menu';
import { useHeaderSession } from '@/hooks/use-header-session';

/** Account, wishlist and cart — the only client-side part of the header. */
export function HeaderActions() {
  const { user, cartCount, wishlistCount } = useHeaderSession();

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 md:ml-2">
      <AccountMenu user={user} />

      <Link
        href="/wishlist"
        className="btn-press relative flex h-10 w-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-white/[0.06] hover:text-ink-950"
        aria-label={`Wishlist, ${wishlistCount} saved item${wishlistCount === 1 ? '' : 's'}`}
      >
        <svg
          className="h-5 w-5 sm:h-6 sm:w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
          />
        </svg>
        {wishlistCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink-900 px-1 text-[10px] font-bold text-cream-50 shadow-soft">
            {wishlistCount > 99 ? '99+' : wishlistCount}
          </span>
        )}
      </Link>

      <Link
        href="/cart"
        className="btn-press relative flex h-10 w-10 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-white/[0.06] hover:text-ink-950"
        aria-label={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
      >
        <svg
          className="h-5 w-5 sm:h-6 sm:w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
          />
        </svg>
        {cartCount > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white shadow-soft">
            {cartCount > 99 ? '99+' : cartCount}
          </span>
        )}
      </Link>
    </div>
  );
}
