import type { MetadataRoute } from 'next';
import { publicOrigin } from '@/lib/site-origin';
import { prisma } from '@/lib/db';
import { isSitemapEligible, SITEMAP_PRODUCT_WHERE } from '@/lib/catalog/eligibility';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // The host that served this sitemap is the host every URL in it must name.
  const base = (await publicOrigin()).replace(/\/$/, '');

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/shop`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/track`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/policies/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/policies/terms`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/policies/shipping`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/policies/returns`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
    // Only published products with a real price: an unpriced/unpublished page
    // must not be advertised to crawlers. Same predicate as the query (shared
    // module) so the rule cannot drift between the two.
    prisma.product.findMany({
      where: SITEMAP_PRODUCT_WHERE,
      select: { slug: true, updatedAt: true, status: true, sellingPrice: true },
      take: 5000,
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  // `lastModified` is emitted ONLY where a real database timestamp exists.
  // Stamping every static route with `new Date()` on each request tells Google
  // that the about page, the FAQ and the policy pages changed seconds ago, and
  // repeated false freshness signals cause lastmod to be ignored entirely.
  return [
    ...staticRoutes,
    ...categories.map((c) => ({
      url: `${base}/categories/${c.slug}`,
      lastModified: c.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...products
      .filter((p) =>
        isSitemapEligible({
          status: p.status,
          pricePaise: Math.round(Number(p.sellingPrice) * 100),
        })
      )
      .map((p) => ({
        url: `${base}/products/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
  ];
}
