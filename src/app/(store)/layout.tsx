import { getSettings } from '@/lib/settings';
import { env } from '@/lib/env';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { DemoBanner } from '@/components/layout/demo-banner';
import { CookieConsent } from '@/components/layout/cookie-consent';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { Concierge } from '@/components/store/assistant/concierge';
import { ScrollProgress } from '@/components/store/scroll-progress';
import { jsonLdScript } from '@/lib/utils';

/**
 * Public storefront shell.
 *
 * This is a route group, not a URL segment: `/shop` stays `/shop`. Living here
 * instead of the root layout means the admin console no longer needs a
 * `headers()` check to hide store chrome — and, crucially, that the storefront
 * does not depend on the request, so it can be statically generated and served
 * from cache.
 *
 * `revalidate` is the default for every page in the group. Pages that must be
 * live per visitor (cart, checkout, account, track) still opt out with
 * `export const dynamic = 'force-dynamic'` of their own.
 */
export const revalidate = 300;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();

  return (
    <>
      {/* Site-wide structured data: real store name + canonical URL only.
          SearchAction targets the genuine /search?q= endpoint. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: settings.storeName,
              url: env.APP_URL,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: settings.storeName,
              url: env.APP_URL,
              potentialAction: {
                '@type': 'SearchAction',
                target: `${env.APP_URL}/search?q={search_term_string}`,
                'query-input': 'required name=search_term_string',
              },
            },
          ]),
        }}
      />
      <ScrollProgress />
      <div className="grain-page" aria-hidden="true" />
      <DemoBanner demoMode={settings.demoMode} />
      {settings.announcement?.enabled && settings.announcement.text && (
        <div className="bg-brand-700 px-4 py-2 text-center text-xs font-medium tracking-wide text-cream-100">
          <span
            className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-accent-300 align-middle"
            aria-hidden="true"
          />
          {settings.announcement.text}
        </div>
      )}
      <Header />
      <main id="main-content" className="flex-1 pb-16 lg:pb-0">
        {children}
      </main>
      <Footer />
      <MobileBottomNav />
      <Concierge storeName={settings.storeName} />
      <CookieConsent storeName={settings.storeName} />
    </>
  );
}
