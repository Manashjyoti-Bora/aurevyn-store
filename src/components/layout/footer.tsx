import Link from 'next/link';
import { configuredSupportEmail, getSettings } from '@/lib/settings';
import { listActiveCategories } from '@/lib/catalog/storefront';
import { Marquee } from '@/components/store/marquee';

const linkClass =
  'inline-flex text-sm text-ink-400 transition-colors duration-150 hover:text-ink-900';

function SupportIcon() {
  return (
    <svg className="h-4 w-4 text-accent-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </svg>
  );
}

export async function Footer() {
  const settings = await getSettings();
  const supportEmail = configuredSupportEmail(settings);
  const categories = (await listActiveCategories()).slice(0, 6);
  const year = new Date().getFullYear();

  return (
    <footer className="relative mt-auto overflow-hidden border-t border-white/[0.07] bg-[#050506] text-ink-400">
      <div className="grain" aria-hidden="true" />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(198,173,122,0.55) 50%, transparent)',
        }}
      />

      <Marquee
        items={[
          'Transparent pricing',
          'Tax-inclusive ₹',
          'Tracked fulfilment',
          'Secure payments',
          'Pan-India delivery',
          'Honest availability',
        ]}
        className="border-b border-white/[0.06] py-3"
      />

      <div className="container-store pb-10 pt-14 sm:pt-16">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-4 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-2">
            <Link href="/" className="group inline-flex items-center gap-3" aria-label={`${settings.storeName} home`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-cream-50 transition-transform duration-500 ease-zenvora group-hover:rotate-[18deg]">
                {settings.storeName.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-sm font-medium uppercase tracking-[0.34em] text-ink-900">
                {settings.storeName}
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-400">
              {settings.storeTagline ||
                'Carefully sourced products, transparent pricing, dependable delivery.'}
            </p>
            {supportEmail ? (
              <a
                href={`mailto:${supportEmail}`}
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-xs font-medium text-ink-700 transition-colors hover:border-accent-400/45 hover:text-ink-950"
              >
                <SupportIcon />
                {supportEmail}
              </a>
            ) : (
              <Link
                href="/contact"
                className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.12] px-4 py-2 text-xs font-medium text-ink-700 transition-colors hover:border-accent-400/45 hover:text-ink-950"
              >
                <SupportIcon />
                Contact us
              </Link>
            )}
          </div>

          <nav aria-label="Shop">
            <h3 className="eyebrow text-accent-400">Shop</h3>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/shop" className={linkClass}>All products</Link></li>
              <li><Link href="/shop?sort=newest" className={linkClass}>New arrivals</Link></li>
              <li><Link href="/track" className={linkClass}>Track your order</Link></li>
              <li><Link href="/cart" className={linkClass}>Cart</Link></li>
            </ul>
          </nav>

          <nav aria-label="Product categories">
            <h3 className="eyebrow text-accent-400">Categories</h3>
            {categories.length > 0 ? (
              <ul className="mt-4 space-y-2.5">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/categories/${category.slug}`} className={linkClass}>
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-ink-400">
                Categories appear once products are added.{' '}
                <Link href="/shop" className="text-accent-300 underline decoration-accent-400/40 underline-offset-2 hover:text-accent-200">
                  Browse all products
                </Link>
                .
              </p>
            )}
          </nav>

          <nav aria-label="Help">
            <h3 className="eyebrow text-accent-400">Help</h3>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/faq" className={linkClass}>FAQ</Link></li>
              <li><Link href="/contact" className={linkClass}>Contact us</Link></li>
              <li><Link href="/policies/shipping" className={linkClass}>Shipping policy</Link></li>
              <li><Link href="/policies/returns" className={linkClass}>Returns &amp; refunds</Link></li>
            </ul>
          </nav>

          <nav aria-label="Legal and account" className="col-span-2 md:col-span-1">
            <h3 className="eyebrow text-accent-400">Legal &amp; account</h3>
            <ul className="mt-4 space-y-2.5">
              <li><Link href="/policies/privacy" className={linkClass}>Privacy policy</Link></li>
              <li><Link href="/policies/terms" className={linkClass}>Terms &amp; conditions</Link></li>
              <li><Link href="/auth/login" className={linkClass}>Log in</Link></li>
              <li><Link href="/auth/register" className={linkClass}>Create account</Link></li>
            </ul>
            {settings.supportPhone && (
              <p className="mt-4 text-xs text-ink-400">Phone: {settings.supportPhone}</p>
            )}
          </nav>
        </div>

        {/* Oversized wordmark — the atelier signature. */}
        <div className="mt-14 select-none" aria-hidden="true">
          <p className="whitespace-nowrap text-[16vw] font-medium leading-[0.8] tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_rgba(245,243,236,0.12)] sm:text-[13vw]">
            {settings.storeName}
          </p>
        </div>
      </div>

      <div className="border-t border-white/[0.06] py-5">
        <div className="container-store flex flex-col items-center justify-between gap-2 text-[11px] tracking-wide text-ink-300 sm:flex-row">
          <p>
            © {year} {settings.storeName}. All rights reserved.
          </p>
          <p>Prices in INR (₹), inclusive of applicable taxes where configured.</p>
        </div>
      </div>
    </footer>
  );
}
