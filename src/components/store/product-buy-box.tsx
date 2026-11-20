'use client';

import { useState } from 'react';
import { formatINR, formatDiscountPercent } from '@/lib/money';
import { QuantityStepper } from './quantity-stepper';
import { AddToCartButton } from './add-to-cart-button';
import { WishlistButton } from './wishlist-button';
import { ShareButton } from './share-button';
import { Badge } from '@/components/ui/badge';
import type { Availability, AvailabilityState } from '@/lib/catalog/availability';

export interface BuyBoxVariant {
  id: string | null;
  label: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  stock: number;
  isActive: boolean;
  /**
   * Server-computed per-variant purchasability. For LOCAL products this is
   * "variant stock > 0"; for supplier-synced products it follows the product's
   * supplier-verified availability (variants do not carry supplier stock).
   */
  purchasable?: boolean;
}

/**
 * Product buy box: variant selection + quantity + add to cart.
 * Server-rendered prices are authoritative at checkout; this component only
 * reflects the selection.
 */
export function ProductBuyBox({
  productId,
  basePricePaise,
  baseCompareAtPaise,
  baseStock,
  variants,
  availability,
  maxPerOrder = 10,
  lowStockThreshold = 5,
}: {
  productId: string;
  basePricePaise: number;
  baseCompareAtPaise: number | null;
  baseStock: number;
  variants: BuyBoxVariant[];
  /**
   * Shared availability model (server-computed). Only a verified out-of-stock
   * blocks purchase; supplier-synced products with no fresh report show an
   * honest "confirmed at checkout" state instead of a fabricated stock badge.
   */
  availability?: Availability;
  maxPerOrder?: number;
  lowStockThreshold?: number;
}) {
  const activeVariants = variants.filter((v) => v.isActive);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    activeVariants.length === 1 ? activeVariants[0].id : null
  );
  const [qty, setQty] = useState(1);

  const selected = activeVariants.find((v) => v.id === selectedVariantId) ?? null;
  const pricePaise = selected ? selected.pricePaise : basePricePaise;
  const compareAtPaise = selected ? selected.compareAtPricePaise : baseCompareAtPaise;
  const stock = selected ? selected.stock : baseStock;
  const discount = formatDiscountPercent(pricePaise, compareAtPaise);
  // Server-computed availability wins; the local fallback below only applies if
  // a caller renders this component without it.
  const state: AvailabilityState =
    availability?.state ??
    (stock === 0
      ? 'OUT_OF_STOCK'
      : lowStockThreshold > 0 && stock <= lowStockThreshold
        ? 'LOW_STOCK'
        : 'IN_STOCK');
  const stateLabel =
    availability?.label ??
    (state === 'LOW_STOCK'
      ? `Low stock — only ${stock} left`
      : state === 'IN_STOCK'
        ? 'In stock'
        : '');
  const soldOut = state === 'OUT_OF_STOCK';
  const unverified = state === 'UNVERIFIED';
  // With several options and none chosen the button is disabled for a reason
  // that is NOT stock — labelling it "Sold out" would be a false urgency cue.
  const needsChoice = activeVariants.length > 1 && selectedVariantId === null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-[2.1rem] font-normal tabular-nums leading-none tracking-[-0.04em] text-ink-900 sm:text-[2.5rem]">
          {formatINR(pricePaise)}
        </p>
        {compareAtPaise && compareAtPaise > pricePaise && (
          <>
            <p className="text-base tabular-nums text-ink-400 line-through">
              {formatINR(compareAtPaise)}
            </p>
            {discount != null && (
              <span className="rounded-full border border-accent-400/35 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-accent-300">
                {discount}% off
              </span>
            )}
          </>
        )}
      </div>
      <p className="text-xs text-ink-400">
        Inclusive of all applicable taxes. Shipping calculated at checkout.
      </p>

      <div aria-live="polite" className="text-sm">
        {soldOut ? (
          <Badge tone="red">Currently sold out</Badge>
        ) : state === 'LOW_STOCK' ? (
          <Badge tone="amber">{stateLabel}</Badge>
        ) : unverified ? (
          // No fabrication: we have no fresh supplier report, so we neither
          // claim stock nor invent scarcity.
          <Badge tone="neutral">{stateLabel || 'Availability confirmed at checkout'}</Badge>
        ) : (
          <Badge tone="green">{stateLabel || 'In stock'}</Badge>
        )}
      </div>

      {activeVariants.length > 0 && (
        <fieldset>
          <legend className="label-text mb-1.5">
            Option{activeVariants.length > 0 && selected ? `: ${selected.label}` : ''}
            {selectedVariantId === null && activeVariants.length > 1 && (
              <span className="ml-1 text-xs font-normal text-amber-700">(choose one)</span>
            )}
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Product options">
            {activeVariants.map((v) => {
              const variantSoldOut = v.purchasable !== undefined ? !v.purchasable : v.stock === 0;
              return (
                <button
                  key={v.id ?? 'default'}
                  type="button"
                  role="radio"
                  aria-checked={selectedVariantId === v.id}
                  onClick={() => setSelectedVariantId(v.id)}
                  disabled={variantSoldOut}
                  className={`btn-press rounded-full border px-4 py-2 text-[13px] font-medium tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    selectedVariantId === v.id
                      ? 'border-brand-700 bg-brand-700 text-cream-50'
                      : 'border-white/[0.14] bg-[#0B0B0E] text-ink-700 hover:border-accent-400/45 hover:text-ink-900'
                  }`}
                >
                  {v.label}
                  {variantSoldOut && <span className="ml-1 text-xs text-ink-400">(sold out)</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <QuantityStepper
          value={qty}
          min={1}
          max={
            availability?.maxQuantity != null
              ? Math.min(maxPerOrder, Math.max(availability.maxQuantity, 1))
              : stock > 0
                ? Math.min(maxPerOrder, stock)
                : maxPerOrder
          }
          onChange={setQty}
        />
        <AddToCartButton
          productId={productId}
          variantId={selectedVariantId ?? undefined}
          qty={qty}
          disabled={soldOut || needsChoice}
          disabledLabel={soldOut ? undefined : 'Choose an option'}
        />
        {/* Buy-now hidden when sold out: a second dead CTA labelled
            'Sold out' next to the first one reads as a rendering bug. */}
        {!soldOut && (
          <AddToCartButton
            productId={productId}
            variantId={selectedVariantId ?? undefined}
            qty={qty}
            disabled={needsChoice}
            disabledLabel="Choose an option"
            goToList
            label="Buy now"
          />
        )}
        <WishlistButton productId={productId} />
        <ShareButton
          title={`Check out this product on Zenvora`}
          url={typeof window !== 'undefined' ? window.location.href : ''}
        />
      </div>
    </div>
  );
}
