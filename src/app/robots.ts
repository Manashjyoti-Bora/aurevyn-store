import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/lib/site-origin';
import { isIndexableDeployment } from '@/lib/site-indexing';

export default async function robots(): Promise<MetadataRoute.Robots> {
  // A preview deployment has its own public hostname and renders every page in
  // full. Crawling it would index a duplicate store that competes with the real
  // domain, so previews are closed completely rather than merely "noindex".
  if (!isIndexableDeployment(process.env.VERCEL_ENV)) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  const base = (await publicOrigin()).replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Utility and personalised routes: a crawler that indexes a cart, a
        // wishlist or a query-parameter search result would publish an empty
        // or device-specific page as if it were the store's content.
        disallow: [
          '/api/',
          '/account',
          '/admin',
          '/auth/',
          '/cart',
          '/checkout',
          '/order/',
          '/search',
          '/wishlist',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
