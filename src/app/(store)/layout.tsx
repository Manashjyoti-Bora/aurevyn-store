import { configuredSupportEmail, getSettings } from '@/lib/settings';
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

/**
 * Only genuine, owner-configured values reach the Organization entity. Each
 * field below is derived from a real setting: an address, phone or social URL
 * that the owner has not supplied produces no markup at all, because a
 * fabricated business detail in JSON-LD is both a Google spam signal and a
 * false claim to the customer.
 */
function socialProfileUrls(social: {
  instagram?: string;
  facebook?: string;
  youtube?: string;
}): string[] {
  const seen = new Set<string>();
  for (const raw of [social.instagram, social.facebook, social.youtube]) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' || url.protocol === 'http:') seen.add(url.toString());
    } catch {
      // A non-URL social handle is not a profile address; emit nothing.
    }
  }
  return [...seen];
}

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  const base = env.APP_URL.replace(/\/$/, '');
  const organizationId = `${base}/#organization`;
  const sameAs = socialProfileUrls(settings.social);
  const supportEmail = configuredSupportEmail(settings);
  const supportPhone = settings.supportPhone?.trim() || null;

  return (
    <>
      {/* Site-wide structured data: real store name, canonical URL, logo and
          only owner-verified contact/social details. SearchAction targets the
          genuine /search?q= endpoint. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript([
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              '@id': organizationId,
              name: settings.storeName,
              url: base,
              logo: {
                '@type': 'ImageObject',
                url: `${base}/icon-512x512.png`,
                width: 512,
                height: 512,
              },
              ...(sameAs.length > 0 ? { sameAs } : {}),
              ...(supportEmail || supportPhone
                ? {
                    contactPoint: {
                      '@type': 'ContactPoint',
                      contactType: 'customer support',
                      areaServed: 'IN',
                      availableLanguage: ['en', 'hi'],
                      ...(supportEmail ? { email: supportEmail } : {}),
                      ...(supportPhone ? { telephone: supportPhone } : {}),
                    },
                  }
                : {}),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              '@id': `${base}/#website`,
              name: settings.storeName,
              url: base,
              inLanguage: 'en-IN',
              publisher: { '@id': organizationId },
              potentialAction: {
                '@type': 'SearchAction',
                target: `${base}/search?q={search_term_string}`,
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
