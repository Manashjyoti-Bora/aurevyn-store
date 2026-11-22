import type { Metadata } from 'next';
import { getCurrentUser } from '@/lib/auth/guards';
import { getCartViewReadOnly } from '@/lib/cart/service';
import { CartManager } from '@/components/store/cart-manager';
import { CheckoutSteps } from '@/components/store/checkout-steps';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your cart',
  alternates: { canonical: '/cart' },
  robots: { index: false },
};

export default async function CartPage() {
  const user = await getCurrentUser();
  const cart = await getCartViewReadOnly(user?.id ?? null);

  return (
    <div className="container-store py-6 sm:py-10">
      <CheckoutSteps current="cart" />

      <header className="mt-8 border-b border-white/[0.07] pb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <p className="eyebrow">
              Order review
              <span className="mx-2 text-accent-500/60" aria-hidden="true">
                /
              </span>
              {cart.itemCount} {cart.itemCount === 1 ? 'piece' : 'pieces'}
            </p>
            <h1 className="display mt-2 text-[2.1rem] sm:text-[2.7rem]">Your cart</h1>
          </div>
          <p className="max-w-xs text-[11px] leading-relaxed text-ink-400 sm:text-right">
            Quantities, coupons and totals are verified by the server before you pay.
          </p>
        </div>
      </header>

      <CartManager initialCart={cart} isLoggedIn={Boolean(user)} />
    </div>
  );
}
