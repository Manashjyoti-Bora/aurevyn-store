'use client';

import Image from '@/components/ui/remote-image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button, LinkButton, Spinner } from '@/components/ui/button';
import { CartIcon, CheckIcon } from '@/components/ui/icons';
import { QuantityStepper } from './quantity-stepper';
import { Input } from '@/components/ui/form';
import { formatINR } from '@/lib/money';
import { Alert } from '@/components/ui/feedback';
import type { CartView } from '@/lib/cart/service';

/**
 * Cart page interactions: quantity changes, line removal and coupon
 * apply/remove - all hitting the cart API then refreshing server state.
 */
export function CartManager({
  initialCart,
  isLoggedIn,
}: {
  initialCart: CartView;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(initialCart.couponError);
  const cart = initialCart;

  async function run(fn: () => Promise<unknown>, errorPrefix: string) {
    try {
      await fn();
      router.refresh();
    } catch (err) {
      toast(
        err instanceof ApiClientError ? err.message : `${errorPrefix}. Please try again.`,
        'error'
      );
    }
  }

  async function updateQty(
    itemId: string,
    productId: string,
    variantId: string | null,
    quantity: number
  ) {
    setBusyItem(itemId);
    await run(
      () =>
        apiFetch(`/api/cart/item`, {
          method: 'PATCH',
          body: { itemId, productId, variantId, quantity },
        }),
      'Could not update quantity'
    );
    setBusyItem(null);
  }

  async function removeItem(itemId: string) {
    setBusyItem(itemId);
    await run(
      () => apiFetch(`/api/cart/item`, { method: 'DELETE', body: { itemId } }),
      'Could not remove item'
    );
    setBusyItem(null);
  }

  async function applyCoupon() {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponError(null);
    try {
      await apiFetch('/api/cart/coupon', { body: { code } });
      setCouponInput('');
      toast('Coupon applied', 'success');
      router.refresh();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Could not apply coupon';
      setCouponError(msg);
    } finally {
      setCouponBusy(false);
    }
  }

  async function removeCoupon() {
    setCouponBusy(true);
    await run(() => apiFetch('/api/cart/coupon', { method: 'DELETE' }), 'Could not remove coupon');
    setCouponBusy(false);
  }

  if (cart.isEmpty) {
    return (
      <div className="atelier-panel mt-8 px-6 py-14 text-center sm:py-20">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-accent-400">
          <CartIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="display mt-5 text-2xl">Your cart is empty</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-400">
          Nothing has been added yet. Browse the catalogue and choose a piece to keep.
        </p>
        <div className="mt-7">
          <LinkButton href="/shop" size="lg">
            Enter the catalogue
          </LinkButton>
        </div>
      </div>
    );
  }

  const unavailable = cart.lines.filter((l) => !l.available);
  const netSubtotal = Math.max(0, cart.subtotalPaise - (cart.coupon?.discountPaise ?? 0));
  const freeShippingRemaining =
    cart.freeShippingThresholdPaise > 0
      ? Math.max(0, cart.freeShippingThresholdPaise - netSubtotal)
      : 0;
  const freeShippingProgress =
    cart.freeShippingThresholdPaise > 0
      ? Math.min(100, Math.round((netSubtotal / cart.freeShippingThresholdPaise) * 100))
      : 100;

  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:gap-10">
      <div className="space-y-4">
        {cart.freeShippingThresholdPaise > 0 && (
          <div className="atelier-panel p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5 text-[12px]">
                {freeShippingRemaining === 0 ? (
                  <>
                    <CheckIcon className="h-4 w-4 shrink-0 text-accent-300" />
                    <span className="text-ink-800">Complimentary shipping unlocked</span>
                  </>
                ) : (
                  <span className="text-ink-500">
                    Add{' '}
                    <strong className="font-medium tabular-nums text-ink-900">
                      {formatINR(freeShippingRemaining)}
                    </strong>{' '}
                    more for complimentary shipping
                  </span>
                )}
              </div>
              <span className="shrink-0 text-[10px] tabular-nums tracking-[0.16em] text-accent-400">
                {freeShippingProgress}%
              </span>
            </div>
            <div
              className="mt-3 h-[2px] w-full overflow-hidden bg-white/[0.08]"
              role="progressbar"
              aria-valuenow={freeShippingProgress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Complimentary shipping progress"
            >
              <div
                className="h-full bg-gradient-to-r from-accent-500/60 to-accent-300 transition-all duration-300 ease-zenvora"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        )}

        {unavailable.length > 0 && (
          <Alert
            tone="warning"
            title="Some items changed"
            className="border-amber-400/20 bg-amber-400/[0.05] text-amber-800"
          >
            {unavailable.map((l) => l.name).join(', ')} — stock is no longer sufficient. Adjust the
            quantity or remove the item to continue.
          </Alert>
        )}

        <ul className="atelier-panel divide-y divide-white/[0.06]">
          {cart.lines.map((line) => (
            <li key={line.itemId} className="flex gap-4 p-4 sm:p-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] sm:h-24 sm:w-24">
                {line.image ? (
                  <Image
                    src={line.image}
                    alt={line.name}
                    fill
                    sizes="96px"
                    className="object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span
                    className="flex h-full items-center justify-center text-ink-300"
                    aria-hidden="true"
                  >
                    <CartIcon className="h-6 w-6" />
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${line.slug}`}
                      className="line-clamp-2 text-[13.5px] font-medium leading-snug text-ink-900 transition-colors hover:text-accent-300"
                    >
                      {line.name}
                    </Link>
                    {line.variantName && (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-ink-400">
                        {line.variantName}
                      </p>
                    )}
                    <p className="mt-1.5 text-[11px] tabular-nums text-ink-500">
                      {formatINR(line.unitPricePaise)} each
                    </p>
                  </div>
                  <p className="shrink-0 text-[14px] font-medium tabular-nums text-ink-900">
                    {formatINR(line.lineTotalPaise)}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  {busyItem === line.itemId ? (
                    <Spinner className="h-5 w-5 text-accent-400" />
                  ) : (
                    <QuantityStepper
                      value={line.quantity}
                      min={1}
                      max={line.maxQuantity || 1}
                      onChange={(q) => updateQty(line.itemId, line.productId, line.variantId, q)}
                      label={`Quantity for ${line.name}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removeItem(line.itemId)}
                    disabled={busyItem === line.itemId}
                    className="rounded-full px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-500 transition-colors hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                  >
                    Remove
                  </button>
                  {!line.available && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-amber-600">
                      Only {line.maxQuantity} available
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Link
            href="/shop"
            className="link-underline inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400 transition-colors hover:text-ink-900"
          >
            ← Continue shopping
          </Link>
        </div>
      </div>

      {/* Summary */}
      <aside className="h-fit space-y-4 lg:sticky lg:top-24" aria-label="Order summary">
        <div className="atelier-panel p-5">
          <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-4">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-400">
              Order summary
            </h2>
            <span className="text-[10px] tabular-nums text-ink-400">
              {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
            </span>
          </div>

          <dl className="mt-4 space-y-3 text-[12.5px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Subtotal</dt>
              <dd className="font-medium tabular-nums text-ink-900">
                {formatINR(cart.subtotalPaise)}
              </dd>
            </div>
            {cart.coupon && (
              <div className="flex justify-between gap-4 text-accent-300">
                <dt>Coupon {cart.coupon.code}</dt>
                <dd className="font-medium tabular-nums">
                  −{formatINR(cart.coupon.discountPaise)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Shipping</dt>
              <dd className="font-medium tabular-nums text-ink-900">
                {cart.shippingPaise === 0 ? (
                  <span className="text-accent-300">Complimentary</span>
                ) : (
                  formatINR(cart.shippingPaise)
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-white/[0.08] pt-4">
            <div className="flex items-end justify-between gap-4">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">
                Total
              </span>
              <span className="text-[1.8rem] leading-none tracking-[-0.04em] tabular-nums text-ink-900">
                {formatINR(cart.grandTotalPaise)}
              </span>
            </div>
            <p className="mt-2 text-right text-[10px] leading-relaxed text-ink-500">
              Verified by the server at checkout
            </p>
          </div>

          <div className="mt-5">
            <LinkButton href="/checkout" size="lg" className="w-full">
              Proceed to checkout
            </LinkButton>
            {!isLoggedIn && (
              <p className="mt-2.5 text-center text-[10px] leading-relaxed text-ink-500">
                Check out as a guest, or{' '}
                <Link href="/auth/login?next=/checkout" className="link-primary">
                  log in
                </Link>{' '}
                for saved addresses.
              </p>
            )}
          </div>
        </div>

        <div className="atelier-panel p-4 sm:p-5">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-400">
            Coupon
          </h2>
          {cart.coupon ? (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-full border border-accent-400/25 bg-accent-400/[0.06] px-3 py-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-accent-200">
                {cart.coupon.code} applied
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeCoupon}
                disabled={couponBusy}
                className="h-auto px-2 py-1 text-[10px] text-accent-200 hover:bg-white/[0.05]"
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="e.g. WELCOME10"
                  aria-label="Coupon code"
                  aria-invalid={Boolean(couponError)}
                  className="uppercase"
                  maxLength={40}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCoupon}
                  loading={couponBusy}
                  disabled={!couponInput.trim()}
                >
                  Apply
                </Button>
              </div>
              {couponError && (
                <p role="alert" className="text-[11px] font-medium text-red-500">
                  {couponError}
                </p>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
