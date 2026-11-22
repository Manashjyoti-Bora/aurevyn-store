import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';
import {
  listStorefrontProducts,
  listActiveCategories,
  parseSort,
  parsePriceBound,
} from '@/lib/catalog/storefront';
import { ProductGrid } from '@/components/store/product-grid';
import { FilterSidebar } from '@/components/store/filter-sidebar';
import { ListingControls } from '@/components/store/listing-controls';
import { Pagination } from '@/components/ui/table';
import { buildItemListJsonLd } from '@/lib/seo/item-list';
import { jsonLdScript } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: 'Shop all products',
    description: `Browse the full ${settings.storeName} catalog. Transparent ₹ pricing, secure checkout and pan-India delivery.`,
    alternates: { canonical: '/shop' },
  };
}

export interface ListingSearchParams {
  [key: string]: string | undefined;
  q?: string;
  category?: string;
  sort?: string;
  page?: string;
  min?: string;
  max?: string;
  stock?: string;
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const [result, categories] = await Promise.all([
    listStorefrontProducts({
      q: params.q,
      categorySlug: params.category,
      sort: parseSort(params.sort),
      page,
      minPricePaise: parsePriceBound(params.min),
      maxPricePaise: parsePriceBound(params.max),
      inStockOnly: params.stock === '1',
    }),
    listActiveCategories(),
  ]);

  // ItemList tells a crawler this page is a ranked set of product links. Only
  // displayed, published products are listed; an empty result emits nothing.
  const itemListLd = buildItemListJsonLd({
    name: 'Shop all products',
    urlPath: '/shop',
    items: result.items.map((p) => ({ slug: p.slug, name: p.name })),
    page: result.page,
    perPage: result.perPage,
  });

  return (
    <div className="container-store py-6 sm:py-8">
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListLd) }}
        />
      )}
      <header className="relative mb-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B0B0E] p-5 sm:p-7">
        <div className="grain" aria-hidden="true" />
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(198,173,122,0.14),transparent_70%)]"
          aria-hidden="true"
        />
        <div className="relative flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-accent-400">
              Catalogue
            </p>
            <h1 className="display mt-2 text-[2rem] sm:text-[2.6rem]">Shop all products</h1>
            <p className="mt-2 text-sm tabular-nums text-ink-400">
              {result.total} product{result.total === 1 ? '' : 's'}
              {params.category ? ` in ${params.category}` : ''}
            </p>
          </div>
          <p className="text-[9px] font-medium uppercase tracking-[0.26em] text-ink-300">
            Index
            <span className="mx-2 text-accent-500" aria-hidden="true">
              /
            </span>
            Page {result.page} of {Math.max(result.totalPages, 1)}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <div className="order-2 lg:order-1">
          <FilterSidebar
            categories={categories}
            basePath="/shop"
            activeCategory={params.category ?? null}
            searchParams={params}
          />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <div className="mb-4 flex items-center justify-between gap-3">
            <ListingControls />
          </div>
          <ProductGrid products={result.items} />
          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            basePath="/shop"
            searchParams={{
              q: params.q,
              category: params.category,
              sort: params.sort,
              min: params.min,
              max: params.max,
              stock: params.stock,
            }}
          />
        </div>
      </div>
    </div>
  );
}
