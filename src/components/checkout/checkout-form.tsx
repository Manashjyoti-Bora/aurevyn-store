'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  apiFetch,
  ApiClientError,
  checkoutIdempotencyKey,
  clearCheckoutIdempotencyKey,
} from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Alert } from '@/components/ui/feedback';
import { formatINR } from '@/lib/money';
import type { CartView } from '@/lib/cart/service';

export interface CheckoutAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefaultShipping: boolean;
}

export interface CheckoutProps {
  cart: CartView;
  isLoggedIn: boolean;
  userName: string;
  userEmail: string;
  userPhone: string;
  addresses: CheckoutAddress[];
  settings: {
    storeName: string;
    codEnabled: boolean;
    codFeePaise: number;
    flatShippingPaise: number;
    freeShippingAbovePaise: number;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
    returnWindowDays: number;
  };
  payments: { gatewayAvailable: boolean; gatewayIsTest: boolean; gatewayLabel: string };
}

interface FormState {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  paymentMethod: 'PREPAID_GATEWAY' | 'COD';
  customerNote: string;
}

export function CheckoutForm(props: CheckoutProps) {
  const { cart, isLoggedIn, settings, payments, addresses } = props;
  const router = useRouter();
  const defaultAddress = addresses[0];

  const [form, setForm] = useState<FormState>({
    fullName: defaultAddress?.fullName ?? props.userName,
    phone: defaultAddress?.phone ?? props.userPhone,
    line1: defaultAddress?.line1 ?? '',
    line2: defaultAddress?.line2 ?? '',
    city: defaultAddress?.city ?? '',
    state: defaultAddress?.state ?? '',
    postalCode: defaultAddress?.postalCode ?? '',
    country: defaultAddress?.country ?? 'IN',
    guestName: props.userName,
    guestEmail: props.userEmail,
    guestPhone: props.userPhone,
    paymentMethod: payments.gatewayAvailable
      ? 'PREPAID_GATEWAY'
      : settings.codEnabled
        ? 'COD'
        : 'PREPAID_GATEWAY',
    customerNote: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setFieldErrors((fe) => {
      const next = { ...fe };
      delete next[k];
      delete next[`address.${k}`];
      delete next[`guest.${k}`.replace('guest.guest', 'guest.')];
      return next;
    });
  };

  // Display-only totals mirroring server logic; the server recomputes
  // everything authoritatively at order creation.
  const discountPaise = cart.coupon?.discountPaise ?? 0;
  const afterDiscount = cart.subtotalPaise - discountPaise;
  const freeShipping =
    settings.freeShippingAbovePaise > 0 && afterDiscount >= settings.freeShippingAbovePaise;
  const baseShipping = freeShipping
    ? 0
    : cart.shippingPaise > 0
      ? cart.shippingPaise
      : settings.flatShippingPaise;
  const codFee = form.paymentMethod === 'COD' ? settings.codFeePaise : 0;
  const totalPaise = Math.max(
    0,
    afterDiscount + (form.paymentMethod === 'COD' ? baseShipping + codFee : cart.shippingPaise)
  );
  const canPayOnline = payments.gatewayAvailable;
  const canCheckout = canPayOnline || settings.codEnabled;

  function err(path: string): string | undefined {
    return fieldErrors[path];
  }

  // Decorative section index — it follows the sections actually rendered.
  const sectionNo = (index: number) =>
    String(isLoggedIn ? index - 1 : index).padStart(2, '0');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting || !canCheckout) return;
    setSubmitting(true);
    setTopError(null);
    setFieldErrors({});

    const body = {
      paymentMethod: form.paymentMethod,
      address: {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim() || 'IN',
      },
      guest: isLoggedIn
        ? null
        : {
            name: form.guestName.trim(),
            email: form.guestEmail.trim(),
            phone: form.guestPhone.trim(),
          },
      customerNote: form.customerNote.trim() || null,
      idempotencyKey: checkoutIdempotencyKey(),
    };

    try {
      const result = await apiFetch<{
        orderNumber: string;
        nextStep: 'PAYMENT' | 'CONFIRMATION';
        paymentMethod: string;
      }>('/api/checkout', { body });
      clearCheckoutIdempotencyKey();
      toast(`Order ${result.orderNumber} placed`, 'success');
      if (result.nextStep === 'PAYMENT') {
        const guestEmail = !isLoggedIn
          ? `?email=${encodeURIComponent(form.guestEmail.trim())}`
          : '';
        router.push(`/checkout/payment/${result.orderNumber}${guestEmail}`);
      } else {
        const guestEmail =
          !isLoggedIn && result.paymentMethod === 'COD'
            ? `?email=${encodeURIComponent(form.guestEmail.trim())}`
            : '';
        router.push(`/order/${result.orderNumber}/confirmation${guestEmail}`);
      }
    } catch (err_) {
      setSubmitting(false);
      if (err_ instanceof ApiClientError) {
        if (Array.isArray(err_.details)) {
          const map: Record<string, string> = {};
          for (const d of err_.details as Array<{ path: string; message: string }>)
            map[d.path] = d.message;
          setFieldErrors(map);
        }
        setTopError(err_.message);
      } else {
        setTopError('Could not reach the server. Please check your connection and try again.');
      }
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-6">
        {topError && (
          <Alert
            tone="error"
            title="Checkout could not be completed"
            className="border-red-500/25 bg-red-500/[0.06] text-red-500"
          >
            {topError}
          </Alert>
        )}

        {!canCheckout && (
          <Alert
            tone="warning"
            title="Checkout is temporarily unavailable"
            className="border-amber-400/20 bg-amber-400/[0.05] text-amber-800"
          >
            Online payments are not configured on this store yet and Cash on Delivery is disabled.
            The store owner needs to complete the payment setup (see SETUP_CHECKLIST.md). In the
            meantime, please{' '}
            <Link href="/contact" className="link-primary">
              contact us
            </Link>{' '}
            to place your order.
          </Alert>
        )}

        {!isLoggedIn && (
          <section className="atelier-panel p-4 sm:p-5" aria-labelledby="guest-details">
            <div className="flex items-baseline gap-3 border-b border-white/[0.07] pb-3">
              <span className="text-[10px] tabular-nums tracking-[0.2em] text-accent-500/80">
                {sectionNo(1)}
              </span>
              <h2
                id="guest-details"
                className="text-[15px] font-medium tracking-[-0.01em] text-ink-900"
              >
                Your details
              </h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-ink-400">
              Used for order updates and tracking. Already have an account?{' '}
              <Link href="/auth/login?next=/checkout" className="link-primary">
                Log in
              </Link>
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" required error={err('guest.name')}>
                {(p) => (
                  <Input
                    {...p}
                    value={form.guestName}
                    onChange={(e) => set('guestName', e.target.value)}
                    autoComplete="name"
                  />
                )}
              </Field>
              <Field
                label="Email"
                required
                error={err('guest.email')}
                hint="Order confirmation & tracking link"
              >
                {(p) => (
                  <Input
                    {...p}
                    type="email"
                    value={form.guestEmail}
                    onChange={(e) => set('guestEmail', e.target.value)}
                    autoComplete="email"
                  />
                )}
              </Field>
              <Field
                label="Phone"
                required
                error={err('guest.phone')}
                hint="10-digit mobile number for delivery updates"
              >
                {(p) => (
                  <Input
                    {...p}
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.guestPhone}
                    onChange={(e) => set('guestPhone', e.target.value.replace(/\D/g, ''))}
                    autoComplete="tel"
                  />
                )}
              </Field>
            </div>
          </section>
        )}

        <section className="atelier-panel p-4 sm:p-5" aria-labelledby="shipping-address">
          <div className="flex items-baseline gap-3 border-b border-white/[0.07] pb-3">
            <span className="text-[10px] tabular-nums tracking-[0.2em] text-accent-500/80">
              {sectionNo(2)}
            </span>
            <h2
              id="shipping-address"
              className="text-[15px] font-medium tracking-[-0.01em] text-ink-900"
            >
              Shipping address
            </h2>
          </div>
          {addresses.length > 0 && (
            <div className="mt-3 space-y-2">
              {addresses.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      fullName: a.fullName,
                      phone: a.phone,
                      line1: a.line1,
                      line2: a.line2 ?? '',
                      city: a.city,
                      state: a.state,
                      postalCode: a.postalCode,
                      country: a.country,
                    }))
                  }
                  className={`block w-full rounded-xl border p-3 text-left text-sm transition-colors ${
                    i === 0 && a.line1 === form.line1
                      ? 'border-accent-400/55 bg-accent-400/[0.07]'
                      : 'border-white/[0.09] hover:border-accent-400/30'
                  }`}
                >
                  <span className="font-medium text-ink-900">{a.fullName}</span>
                  {a.label && (
                    <span className="ml-2 rounded-full border border-white/[0.1] px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-ink-400">
                      {a.label}
                    </span>
                  )}
                  <span className="mt-0.5 block text-xs text-ink-400">
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} — {a.postalCode} ·{' '}
                    {a.phone}
                  </span>
                </button>
              ))}
              <p className="text-xs text-ink-400">
                Tap a saved address to fill the form, or edit the fields below.
              </p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" required error={err('address.fullName')}>
              {(p) => (
                <Input
                  {...p}
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  autoComplete="name"
                />
              )}
            </Field>
            <Field
              label="Phone"
              required
              error={err('address.phone')}
              hint="Courier contact number"
            >
              {(p) => (
                <Input
                  {...p}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))}
                  autoComplete="tel"
                />
              )}
            </Field>
            <Field
              label="Address line 1"
              required
              error={err('address.line1')}
              className="sm:col-span-2"
            >
              {(p) => (
                <Input
                  {...p}
                  value={form.line1}
                  onChange={(e) => set('line1', e.target.value)}
                  autoComplete="address-line1"
                  placeholder="House/flat no, building, street"
                />
              )}
            </Field>
            <Field label="Address line 2" error={err('address.line2')} className="sm:col-span-2">
              {(p) => (
                <Input
                  {...p}
                  value={form.line2}
                  onChange={(e) => set('line2', e.target.value)}
                  autoComplete="address-line2"
                  placeholder="Area, landmark (optional)"
                />
              )}
            </Field>
            <Field label="City" required error={err('address.city')}>
              {(p) => (
                <Input
                  {...p}
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  autoComplete="address-level2"
                />
              )}
            </Field>
            <Field label="State" required error={err('address.state')}>
              {(p) => (
                <Input
                  {...p}
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  autoComplete="address-level1"
                />
              )}
            </Field>
            <Field label="PIN code" required error={err('address.postalCode')}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  maxLength={6}
                  value={form.postalCode}
                  onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, ''))}
                  autoComplete="postal-code"
                />
              )}
            </Field>
            <Field label="Country" required error={err('address.country')}>
              {(p) => (
                <Input
                  {...p}
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                  autoComplete="country-name"
                />
              )}
            </Field>
          </div>
        </section>

        <section className="atelier-panel p-4 sm:p-5" aria-labelledby="payment-method">
          <div className="flex items-baseline gap-3 border-b border-white/[0.07] pb-3">
            <span className="text-[10px] tabular-nums tracking-[0.2em] text-accent-500/80">
              {sectionNo(3)}
            </span>
            <h2
              id="payment-method"
              className="text-[15px] font-medium tracking-[-0.01em] text-ink-900"
            >
              Payment method
            </h2>
          </div>
          <div className="mt-3 space-y-2" role="radiogroup" aria-labelledby="payment-method">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                form.paymentMethod === 'PREPAID_GATEWAY'
                  ? 'border-accent-400/55 bg-accent-400/[0.07]'
                  : 'border-white/[0.09] hover:border-accent-400/30'
              } ${!canPayOnline ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="PREPAID_GATEWAY"
                checked={form.paymentMethod === 'PREPAID_GATEWAY'}
                onChange={() => set('paymentMethod', 'PREPAID_GATEWAY')}
                disabled={!canPayOnline}
                className="mt-0.5 h-4 w-4 accent-[#c6ad7a]"
              />
              <span className="text-sm">
                <span className="block font-semibold text-ink-900">
                  Pay by UPI QR
                </span>
                <span className="mt-0.5 block text-xs text-ink-400">
                  {canPayOnline
                    ? payments.gatewayIsTest
                      ? 'TEST mode — the payment simulator will run; no real money moves. Clearly marked in your order history.'
                      : 'Scan a QR with any UPI app and submit the reference. We verify it against the store bank account before dispatch.'
                    : 'UPI QR payments are not configured on this store yet.'}
                </span>
              </span>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                form.paymentMethod === 'COD'
                  ? 'border-accent-400/55 bg-accent-400/[0.07]'
                  : 'border-white/[0.09] hover:border-accent-400/30'
              } ${!settings.codEnabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="COD"
                checked={form.paymentMethod === 'COD'}
                onChange={() => set('paymentMethod', 'COD')}
                disabled={!settings.codEnabled}
                className="mt-0.5 h-4 w-4 accent-[#c6ad7a]"
              />
              <span className="text-sm">
                <span className="block font-semibold text-ink-900">
                  Cash on Delivery{' '}
                  {settings.codFeePaise > 0 &&
                    `(＋${formatINR(settings.codFeePaise)} handling fee)`}
                </span>
                <span className="mt-0.5 block text-xs text-ink-400">
                  {settings.codEnabled
                    ? 'Pay in cash/UPI when your order arrives. Keep exact change handy.'
                    : 'Cash on Delivery is not available on this store right now.'}
                </span>
              </span>
            </label>
          </div>
          {err('paymentMethod') && (
            <p role="alert" className="mt-2 text-xs font-medium text-red-500">
              {err('paymentMethod')}
            </p>
          )}
        </section>

        <section className="atelier-panel p-4 sm:p-5" aria-labelledby="order-note">
          <div className="flex items-baseline gap-3 border-b border-white/[0.07] pb-3">
            <span className="text-[10px] tabular-nums tracking-[0.2em] text-accent-500/80">
              {sectionNo(4)}
            </span>
            <h2
              id="order-note"
              className="text-[15px] font-medium tracking-[-0.01em] text-ink-900"
            >
              Delivery instructions{' '}
              <span className="text-[11px] font-normal text-ink-400">(optional)</span>
            </h2>
          </div>
          <div className="mt-3">
            <Textarea
              value={form.customerNote}
              onChange={(e) => set('customerNote', e.target.value)}
              maxLength={500}
              placeholder="e.g. Call before delivery, leave with neighbour…"
              aria-label="Delivery instructions"
            />
          </div>
        </section>
      </div>

      {/* Summary */}
      <aside className="h-fit lg:sticky lg:top-24" aria-label="Order summary">
        <div className="atelier-panel p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] pb-3">
            <h2 className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-400">
              Your order
            </h2>
            <span className="text-[10px] tabular-nums text-ink-400">
              {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
            {cart.lines.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3 py-2">
                <span className="min-w-0 text-ink-500">
                  {l.quantity} × <span className="font-medium text-ink-900">{l.name}</span>
                  {l.variantName && (
                    <span className="block text-xs text-ink-400">{l.variantName}</span>
                  )}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {formatINR(l.lineTotalPaise)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-2 border-t border-white/[0.08] pt-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Subtotal</dt>
              <dd className="tabular-nums">{formatINR(cart.subtotalPaise)}</dd>
            </div>
            {discountPaise > 0 && (
              <div className="flex justify-between gap-4 text-accent-300">
                <dt>Coupon ({cart.coupon?.code})</dt>
                <dd className="tabular-nums">−{formatINR(discountPaise)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-ink-400">Shipping</dt>
              <dd className="tabular-nums">
                {form.paymentMethod === 'COD' ? (
                  baseShipping === 0 ? (
                    <span className="text-accent-300">Complimentary</span>
                  ) : (
                    formatINR(baseShipping)
                  )
                ) : cart.shippingPaise === 0 ? (
                  <span className="text-accent-300">Complimentary</span>
                ) : (
                  formatINR(cart.shippingPaise)
                )}
              </dd>
            </div>
            {codFee > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-400">COD handling fee</dt>
                <dd className="tabular-nums">{formatINR(codFee)}</dd>
              </div>
            )}
            <div className="flex items-end justify-between gap-4 border-t border-white/[0.1] pt-4">
              <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400">
                Total payable
              </dt>
              <dd className="text-[1.6rem] font-medium leading-none tracking-[-0.04em] tabular-nums text-ink-900">
                {formatINR(totalPaise)}
              </dd>
            </div>
          </dl>

          <Button
            type="submit"
            size="lg"
            className="mt-5 w-full"
            loading={submitting}
            disabled={!canCheckout}
          >
            {submitting
              ? 'Placing order…'
              : form.paymentMethod === 'COD'
                ? 'Place order (COD)'
                : 'Place order & get UPI QR'}
          </Button>

          <p className="mt-2.5 text-center text-[10px] leading-relaxed text-ink-500">
            Totals are verified by the server before the order is created.
          </p>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-400">
            By placing this order you agree to our{' '}
            <Link href="/policies/terms" className="link-primary">
              Terms
            </Link>
            ,{' '}
            <Link href="/policies/privacy" className="link-primary">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/policies/returns" className="link-primary">
              Returns Policy
            </Link>
            . Estimated delivery: {settings.estimatedDaysMin}–{settings.estimatedDaysMax} days after
            dispatch.
          </p>
        </div>
        <p className="mt-3 text-center text-xs text-ink-400">
          <Link href="/cart" className="link-primary">
            ← Back to cart
          </Link>
        </p>
      </aside>
    </form>
  );
}
