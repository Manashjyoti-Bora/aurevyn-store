import { env } from '@/lib/env';

/**
 * schema.org ItemList for product listing pages (shop, category, search).
 *
 * Google uses an ItemList to understand that a page is a ranked set of product
 * links rather than an unstructured grid, which is what makes a listing eligible
 * for richer treatment in search. Only data the page already displays is
 * emitted: the product name and its canonical URL. No prices, ratings or
 * availability are invented here — the individual product pages carry those,
 * with their own verified values.
 */
export interface ItemListProduct {
  slug: string;
  name: string;
}

export function buildItemListJsonLd(input: {
  name: string;
  urlPath: string;
  items: ItemListProduct[];
  /** 1-based page number, so positions stay unique across pagination. */
  page?: number;
  /** Items per page, used to offset positions on later pages. */
  perPage?: number;
}): Record<string, unknown> | null {
  if (input.items.length === 0) return null;

  const base = env.APP_URL.replace(/\/$/, '');
  const offset = Math.max(0, (input.page ?? 1) - 1) * (input.perPage ?? input.items.length);
  const url = input.urlPath.startsWith('http')
    ? input.urlPath
    : `${base}${input.urlPath.startsWith('/') ? '' : '/'}${input.urlPath}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: input.name,
    url,
    numberOfItems: input.items.length,
    itemListElement: input.items.map((item, index) => ({
      '@type': 'ListItem',
      position: offset + index + 1,
      url: `${base}/products/${item.slug}`,
      name: item.name,
    })),
  };
}
