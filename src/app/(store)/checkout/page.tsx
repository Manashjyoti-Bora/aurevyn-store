import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/guards';
import { getCartViewReadOnly } from '@/lib/cart/service';
import { getSettings } from '@/lib/settings';
import { loadPaymentStatus } from '@/lib/payments';
import { prisma } from '@/lib/db';
import { CheckoutForm } from '@/components/checkout/checkout-form';
import { CheckoutSteps } from '@/components/store/checkout-steps';
import { EmptyState } from '@/components/ui/feedback';
import { LinkButton } from '@/components/ui/button';
import { CartIcon } from '@/components/ui/icons';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false },
};

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  const [cart, settings, payments, addresses, profile] = await Promise.all([
    getCartViewReadOnly(user?.id ?? null),
    getSettings(),
    loadPaymentStatus(),
    user
      ? prisma.address.findMany({
          where: { userId: user.id },
          orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'desc' }],
          take: 5,
        })
      : Promise.resolve([]),
    user
      ? prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } })
      : Promise.resolve(null),
  ]);

  if (cart.isEmpty) {
    return (
      <div className="container-store py-6 sm:py-10">
        <CheckoutSteps current="checkout" />
        <div className="mt-8">
          <p className="eyebrow">Secure checkout</p>
          <h1 className="display mt-2 text-[2.1rem] sm:text-[2.7rem]">Checkout</h1>
        </div>
        <div className="mt-6">
          <EmptyState
            icon={<CartIcon className="h-6 w-6" />}
            title="Your cart is empty"
            description="Add products to your cart before checking out."
            action={<LinkButton href="/shop">Browse products</LinkButton>}
          />
        </div>
      </div>
    );
  }

  const gatewayAvailable = payments.kind !== 'NONE';
  const paymentLine = gatewayAvailable
    ? payments.isTest
      ? 'Test mode — no money moves'
      : 'UPI QR · scan & pay'
    : settings.shipping.codEnabled
      ? 'Cash on delivery'
      : 'Not configured';

  return (
    <div className="container-store py-6 sm:py-10">
      <CheckoutSteps current="checkout" />

      <header className="mt-8 border-b border-white/[0.07] pb-6">
        <p className="eyebrow">
          Secure checkout
          <span className="mx-2 text-accent-500/60" aria-hidden="true">
            /
          </span>
          {cart.itemCount} {cart.itemCount === 1 ? 'piece' : 'pieces'}
        </p>
        <h1 className="display mt-2 text-[2.1rem] sm:text-[2.7rem]">Checkout</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-400">
          Review your details below. Every total is verified by the server before the order is
          created.
          {user ? (
            <>
              {' '}
              Logged in as <span className="font-medium text-ink-700">{user.email}</span> —{' '}
              <Link href="/account" className="link-primary">
                manage account
              </Link>
            </>
          ) : (
            <>
              {' '}
              Checking out as guest —{' '}
              <Link href="/auth/login?next=/checkout" className="link-primary">
                log in
              </Link>{' '}
              for saved addresses.
            </>
          )}
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-3">
          {[
            { k: 'Payment', v: paymentLine },
            {
              k: 'Dispatch',
              v: `${settings.shipping.estimatedDaysMin}–${settings.shipping.estimatedDaysMax} business days`,
            },
            {
              k: 'Returns',
              v:
                settings.policies.returnWindowDays > 0
                  ? `${settings.policies.returnWindowDays}-day window`
                  : 'See returns policy',
            },
          ].map((row) => (
            <div key={row.k} className="bg-[#0A0A0C] px-4 py-3">
              <dt className="text-[9px] font-medium uppercase tracking-[0.22em] text-accent-500/80">
                {row.k}
              </dt>
              <dd className="mt-1.5 text-[12.5px] leading-snug text-ink-700">{row.v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <CheckoutForm
        cart={cart}
        isLoggedIn={Boolean(user)}
        userName={user?.name ?? ''}
        userEmail={user?.email ?? ''}
        userPhone={profile?.phone ?? ''}
        addresses={addresses.map((a) => ({
          id: a.id,
          label: a.label,
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
          isDefaultShipping: a.isDefaultShipping,
        }))}
        settings={{
          storeName: settings.storeName,
          codEnabled: settings.shipping.codEnabled,
          codFeePaise: settings.shipping.codFeePaise,
          flatShippingPaise: settings.shipping.flatRatePaise,
          freeShippingAbovePaise: settings.shipping.freeAbovePaise,
          estimatedDaysMin: settings.shipping.estimatedDaysMin,
          estimatedDaysMax: settings.shipping.estimatedDaysMax,
          returnWindowDays: settings.policies.returnWindowDays,
        }}
        payments={{
          gatewayAvailable,
          gatewayIsTest: payments.isTest,
          gatewayLabel: payments.label,
        }}
      />
    </div>
  );
}
