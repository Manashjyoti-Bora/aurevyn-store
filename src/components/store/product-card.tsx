import Link from 'next/link';
import Image from '@/components/ui/remote-image';
import { formatINR, formatDiscountPercent } from '@/lib/money';
import { AddToCartButton } from './add-to-cart-button';
import { WishlistButton } from './wishlist-button';
import type { ProductCardData } from '@/lib/catalog/storefront';

function BagGlyph({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.1}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.5 8h13l-1 11.5a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4L5.5 8Z"
      />
      <path strokeLinecap="round" d="M9 10V6.8a3 3 0 0 1 6 0V10" />
    </svg>
  );
}

/**
 * Storefront product card — atelier treatment.
 * Portrait photography on a lacquer plate, gold hairline that lights up on
 * hover, a slow image push-in, and the real second catalog image crossfading
 * in. Every number is real (pricing engine + inventory); no fabricated proof.
 */
export function ProductCard({ product }: { product: ProductCardData }) {
  const availability = product.availability;
  const soldOut = availability.state === 'OUT_OF_STOCK';
  const lowStock = availability.state === 'LOW_STOCK';
  const lowStockQty = lowStock ? availability.maxQuantity : null;
  const discount = formatDiscountPercent(product.pricePaise, product.compareAtPricePaise);
  const onSale =
    product.compareAtPricePaise != null && product.compareAtPricePaise > product.pricePaise;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-cream-100 transition-[transform,border-color,box-shadow] duration-[320ms] ease-zenvora focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 focus-within:ring-offset-cream-50 [@media(hover:hover)]:hover:-translate-y-1 [@media(hover:hover)]:hover:border-accent-400/30 [@media(hover:hover)]:hover:shadow-[0_40px_80px_-40px_rgba(0,0,0,0.95)]">
      {/* Fracture ticks — two hairlines that draw in on hover, like the light
          catching a cut edge of the frame. Decorative only. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-10 h-8 w-px origin-top scale-y-0 bg-gradient-to-b from-accent-400/70 to-transparent transition-transform duration-500 ease-zenvora [@media(hover:hover)]:group-hover:scale-y-100"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-10 h-8 w-px origin-bottom scale-y-0 bg-gradient-to-t from-accent-400/50 to-transparent transition-transform duration-500 ease-zenvora [@media(hover:hover)]:group-hover:scale-y-100"
      />

      <div className="relative aspect-[4/5] overflow-hidden bg-cream-200">
        {product.imageUrls[0] ? (
          <Link href={`/products/${product.slug}`} tabIndex={-1} aria-hidden="true">
            <Image
              src={product.imageUrls[0]}
              alt={product.imageAlt || product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-[900ms] ease-zenvora group-focus-within:scale-[1.06] [@media(hover:hover)]:group-hover:scale-[1.06]"
              loading="lazy"
            />
            {product.imageUrls[1] && (
              <Image
                src={product.imageUrls[1]}
                alt=""
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className="object-cover opacity-0 transition-[opacity,transform] duration-[700ms] ease-zenvora group-focus-within:scale-[1.06] group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:scale-[1.06] [@media(hover:hover)]:group-hover:opacity-100"
                loading="lazy"
              />
            )}
            {/* Bottom fade so badges and the image plate read as one object. */}
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent opacity-70"
              aria-hidden="true"
            />
          </Link>
        ) : (
          <Link
            href={`/products/${product.slug}`}
            tabIndex={-1}
            aria-hidden="true"
            className="flex h-full items-center justify-center text-ink-300"
          >
            <BagGlyph />
          </Link>
        )}

        {soldOut && (
          <div className="absolute inset-0 bg-cream-50/75 backdrop-blur-[1px]" aria-hidden="true">
            <span className="absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-cream-100/95 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500">
              Sold out
            </span>
          </div>
        )}

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {discount != null && !soldOut && (
            <span className="rounded-full bg-accent-400 px-2 py-0.5 text-[10px] font-bold leading-4 text-cream-50 shadow-soft">
              −{discount}%
            </span>
          )}
          {lowStock && (
            <span className="rounded-full border border-accent-400/25 bg-black/55 px-2 py-0.5 text-[10px] font-medium leading-4 text-accent-300 backdrop-blur-sm">
              {lowStockQty != null ? `Only ${lowStockQty} left` : 'Low stock'}
            </span>
          )}
        </div>
        <div className="absolute right-2.5 top-2.5 z-10">
          <WishlistButton productId={product.id} compact />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5 sm:gap-1.5 sm:p-4">
        {product.categoryName && (
          <p className="truncate text-[9px] font-medium uppercase tracking-[0.2em] text-ink-400 sm:text-[10px]">
            {product.categoryName}
          </p>
        )}
        <h3 className="line-clamp-2 text-[13px] font-normal leading-snug tracking-[-0.01em] text-ink-900 sm:text-[15px]">
          <Link
            href={`/products/${product.slug}`}
            className="transition-colors after:absolute after:inset-0 after:content-[''] [@media(hover:hover)]:hover:text-accent-300"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-col gap-2 pt-2.5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
            <p className="text-sm font-semibold tabular-nums leading-5 text-ink-900 sm:text-base">
              {formatINR(product.pricePaise)}
            </p>
            {onSale && (
              <p className="text-[11px] tabular-nums text-ink-400 line-through sm:text-xs">
                {formatINR(product.compareAtPricePaise!)}
              </p>
            )}
          </div>
          <div className="relative z-10">
            <AddToCartButton
              productId={product.id}
              disabled={soldOut}
              compact
              className="w-full sm:w-auto"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
