import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = env.APP_URL.replace(/\/$/, '');
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
