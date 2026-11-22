'use client';

import { useEffect, useState } from 'react';
import type { SessionUser } from '@/lib/auth/session';

export interface HeaderSession {
  user: SessionUser | null;
  cartCount: number;
  wishlistCount: number;
}

const EMPTY: HeaderSession = { user: null, cartCount: 0, wishlistCount: 0 };

/**
 * The header is rendered once and cached with the page, so anything personal
 * (who is signed in, how many items are in the cart) is fetched on the client
 * instead of read from cookies during the server render. That is what lets the
 * storefront pages be statically cached while the header still feels live.
 */
export function useHeaderSession(): HeaderSession {
  const [session, setSession] = useState<HeaderSession>(EMPTY);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch('/api/header', { credentials: 'same-origin', cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((payload) => {
          if (!alive || !payload?.data) return;
          setSession({
            user: payload.data.user ?? null,
            cartCount: payload.data.cartCount ?? 0,
            wishlistCount: payload.data.wishlistCount ?? 0,
          });
        })
        .catch(() => {
          /* The storefront must never fail because the header could not load. */
        });
    };

    load();
    // Re-read when the tab regains focus: a cart change in another tab should
    // not leave a stale badge behind.
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return session;
}
