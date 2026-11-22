'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const underline =
  'relative text-ink-900 after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-accent-400';

/**
 * Section navigation with an accurate active state. `usePathname` runs in the
 * browser, so the shell it lives in does not need `headers()` and can be cached.
 */
export function HeaderNav({ categories }: { categories: Array<{ name: string; slug: string }> }) {
  const pathname = usePathname() ?? '';
  const isShop = pathname === '/shop' || pathname.startsWith('/shop/');
  const isTrack = pathname === '/track' || pathname.startsWith('/track/');
  const catActive = (slug: string) =>
    pathname === `/categories/${slug}` || pathname.startsWith(`/categories/${slug}/`);

  return (
    <nav
      aria-label="Main navigation"
      className="hidden min-w-0 flex-1 items-center gap-5 overflow-hidden pl-4 lg:flex"
    >
      <Link
        href="/shop"
        aria-current={isShop ? 'page' : undefined}
        className={`shrink-0 whitespace-nowrap text-[12.5px] font-medium tracking-wide text-ink-400 transition-colors hover:text-ink-900 ${isShop ? underline : ''}`}
      >
        Shop
      </Link>
      <div className="hidden items-center gap-5 2xl:flex">
        {categories.slice(0, 4).map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            aria-current={catActive(c.slug) ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap text-[12.5px] text-ink-400 transition-colors hover:text-ink-900 ${catActive(c.slug) ? underline : ''}`}
          >
            {c.name}
          </Link>
        ))}
      </div>
      <Link
        href="/track"
        aria-current={isTrack ? 'page' : undefined}
        className={`shrink-0 whitespace-nowrap text-[12.5px] text-ink-400 transition-colors hover:text-ink-900 ${isTrack ? underline : ''}`}
      >
        Track order
      </Link>
    </nav>
  );
}
