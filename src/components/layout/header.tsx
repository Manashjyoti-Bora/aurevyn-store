import Link from 'next/link';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getSettings } from '@/lib/settings';
import { MobileMenu } from './mobile-menu';
import { SearchForm } from './search-form';
import { ThemeToggle } from './theme-toggle';
import { HeaderNav } from './header-nav';
import { HeaderActions } from './header-actions';

/**
 * Store header.
 *
 * Deliberately reads no cookies and no request headers: the categories and the
 * store name come from cacheable sources, and the personal parts (session,
 * cart, wishlist) are hydrated by <HeaderActions />. That keeps every
 * storefront page shareable by a CDN instead of rendered per visitor.
 */
export async function Header() {
  const [settings, categories] = await Promise.all([
    getSettings(),
    // The shell must render even if the database is briefly unreachable: a
    // navigation without categories is recoverable, a 500 error page is not.
    prisma.category
      .findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        take: 7,
        select: { name: true, slug: true },
      })
      .catch((error: unknown) => {
        logger.warn('Header categories unavailable', { error: String(error) });
        return [] as Array<{ name: string; slug: string }>;
      }),
  ]);

  return (
    <header className="glass-header sticky top-0 border-x-0 border-t-0">
      <div className="container-store">
        <div className="flex h-14 items-center gap-2 sm:gap-3">
          <MobileMenu categories={categories} />

          <Link
            href="/"
            className="group flex min-w-0 shrink-0 items-center gap-2"
            aria-label={`${settings.storeName} home`}
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-[13px] font-semibold text-cream-50 transition-transform duration-500 ease-aurevyn [@media(hover:hover)]:group-hover:rotate-[18deg]"
            >
              {settings.storeName.slice(0, 1).toUpperCase()}
            </span>
            <span className="max-w-[130px] truncate text-xs font-medium uppercase tracking-[0.26em] text-ink-900 sm:max-w-none sm:text-sm sm:tracking-[0.3em]">
              {settings.storeName}
            </span>
          </Link>

          <HeaderNav categories={categories} />

          <div className="ml-auto hidden w-full max-w-[15rem] flex-1 md:block lg:max-w-[13rem] xl:max-w-xs">
            <SearchForm />
          </div>

          <ThemeToggle className="hidden sm:flex" />
          <HeaderActions />
        </div>

        <div className="pb-2.5 md:hidden">
          <SearchForm />
        </div>
      </div>
    </header>
  );
}
