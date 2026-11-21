import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/settings';
import { resolveAvailability } from '@/lib/catalog/availability';

export const dynamic = 'force-dynamic';

/**
 * Google Merchant Center product feed — no GTIN/GSIN required.
 *
 * Merchant Center normally asks for a GTIN (the "GSIN"/barcode number). For
 * own-brand or generic resold goods that have no barcode, the documented path
 * is to send `identifier_exists: no` together with a brand and an MPN. This
 * feed does exactly that for every product, so the store can be listed in
 * Google Shopping without owning a single barcode.
 *
 * Only ACTIVE, priced products with at least one image are emitted — an item
 * without a real image or price is rejected by Google and would be dishonest
 * to submit. Availability is derived from the same model checkout uses.
 */

function xml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function money(paise: number): string {
  return `${(paise / 100).toFixed(2)} INR`;
}

export async function GET(): Promise<Response> {
  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'ACTIVE', sellingPrice: { gt: 0 }, images: { some: {} } },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        sku: true,
        brand: true,
        sellingPrice: true,
        stockMode: true,
        stock: true,
        hasVariants: true,
        lowStockThreshold: true,
        category: { select: { name: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }], select: { url: true } },
        variants: { where: { isActive: true }, select: { stock: true } },
        supplierProduct: { select: { inStock: true, stockQty: true, lastSyncedAt: true } },
      },
      orderBy: [{ sortOrder: 'desc' }, { createdAt: 'desc' }],
      take: 5000,
    }),
    getSettings(),
  ]);

  const storeName = settings.storeName;
  const items = products.map((p) => {
    const availability = resolveAvailability({
      isActive: true,
      stockMode: p.stockMode,
      stock: p.stock,
      hasVariants: p.hasVariants,
      variants: p.variants.map((v) => ({ stock: v.stock })),
      lowStockThreshold: p.lowStockThreshold,
      supplier: p.supplierProduct
        ? {
            inStock: p.supplierProduct.inStock,
            stockQty: p.supplierProduct.stockQty,
            lastSyncedAt: p.supplierProduct.lastSyncedAt,
          }
        : null,
    });
    const image = p.images[0]?.url ?? '';
    const imageLink = image.startsWith('http') ? image : `${env.APP_URL}${image}`;
    const description = (p.shortDescription || p.description)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);

    return [
      '<item>',
      `<g:id>${xml(p.id)}</g:id>`,
      `<g:title>${xml(p.name.slice(0, 150))}</g:title>`,
      `<g:description>${xml(description)}</g:description>`,
      `<g:link>${xml(`${env.APP_URL}/products/${p.slug}`)}</g:link>`,
      `<g:image_link>${xml(imageLink)}</g:image_link>`,
      `<g:price>${money(Math.round(Number(p.sellingPrice) * 100))}</g:price>`,
      `<g:availability>${availability.purchasable ? 'in_stock' : 'out_of_stock'}</g:availability>`,
      '<g:condition>new</g:condition>',
      `<g:brand>${xml(p.brand || storeName)}</g:brand>`,
      // No barcode on file: tell Google instead of inventing one.
      '<g:identifier_exists>no</g:identifier_exists>',
      `<g:mpn>${xml(p.sku || p.slug)}</g:mpn>`,
      p.category ? `<g:product_type>${xml(p.category.name)}</g:product_type>` : null,
      '<g:shipping>',
      '<g:country>IN</g:country>',
      '<g:service>Standard</g:service>',
      `<g:price>${money(settings.shipping.flatRatePaise)}</g:price>`,
      '</g:shipping>',
      '<g:adult>no</g:adult>',
      '</item>',
    ]
      .filter((line): line is string => line !== null)
      .join('');
  });

  const xmlBody = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    '<channel>',
    `<title>${xml(storeName)}</title>`,
    `<link>${xml(env.APP_URL)}</link>`,
    `<description>${xml(settings.storeTagline || `${storeName} product feed`)}</description>`,
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');

  return new Response(xmlBody, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=1800, s-maxage=1800',
    },
  });
}
