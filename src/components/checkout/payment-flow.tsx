'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { apiFetch, ApiClientError } from '@/lib/client/api';
import { toast } from '@/components/ui/toaster';
import { Button, Spinner } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { Input } from '@/components/ui/form';
import { formatINR } from '@/lib/money';

type Phase =
  | 'idle'
  | 'starting'
  | 'awaiting'
  | 'submitting'
  | 'submitted'
  | 'test-panel'
  | 'failed'
  | 'pending';

interface CreateResponse {
  mode: 'upi-qr' | 'test-simulator' | 'unconfigured';
  provider: string;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  orderNumber: string;
  qrDataUrl: string | null;
  upiUri: string | null;
  upiVpa: string | null;
  upiPayeeName: string | null;
  storeName: string;
  prefill: { name: string; email: string; contact: string };
}

export function PaymentFlow({
  orderNumber,
  amountPaise,
  guestEmail,
  initialFailure,
}: {
  orderNumber: string;
  amountPaise: number;
  guestEmail?: string;
  initialFailure?: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(initialFailure ?? null);
  const [data, setData] = useState<CreateResponse | null>(null);
  const [utr, setUtr] = useState('');
  const [utrError, setUtrError] = useState<string | null>(null);
  const [testOutcomeBusy, setTestOutcomeBusy] = useState<'success' | 'failure' | null>(null);
  const [copied, setCopied] = useState(false);

  const confirmationHref = `/order/${orderNumber}/confirmation${
    guestEmail ? `?email=${encodeURIComponent(guestEmail)}` : ''
  }`;

  async function start() {
    setPhase('starting');
    setError(null);
    try {
      const res = await apiFetch<CreateResponse>('/api/payments/create', {
        body: { orderNumber, email: guestEmail },
      });
      setData(res);
      if (res.mode === 'test-simulator') {
        setPhase('test-panel');
        return;
      }
      if (res.mode !== 'upi-qr' || !res.qrDataUrl) {
        setError(
          'UPI QR payments are not configured on this store yet. Please contact support and we will arrange payment.'
        );
        setPhase('failed');
        return;
      }
      setPhase('awaiting');
    } catch (err) {
      setPhase('failed');
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not prepare the payment. Please check your connection and try again.'
      );
    }
  }

  async function copyVpa() {
    if (!data?.upiVpa) return;
    try {
      await navigator.clipboard.writeText(data.upiVpa);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function submitUtr(e: FormEvent) {
    e.preventDefault();
    const value = utr.trim();
    if (!/^[A-Za-z0-9]{8,22}$/.test(value)) {
      setUtrError('Enter the 8–22 character reference shown in your UPI app.');
      return;
    }
    setUtrError(null);
    setPhase('submitting');
    try {
      await apiFetch('/api/payments/upi/submit', {
        body: { orderNumber, utr: value, email: guestEmail },
      });
      setPhase('submitted');
      toast('Reference received — we will verify it', 'success');
    } catch (err) {
      setPhase('awaiting');
      setUtrError(
        err instanceof ApiClientError ? err.message : 'Could not submit the reference. Try again.'
      );
    }
  }

  async function simulateTest(outcome: 'success' | 'failure') {
    setTestOutcomeBusy(outcome);
    try {
      const result = await apiFetch<{ redirect: string }>('/api/payments/test/simulate', {
        body: { orderNumber, outcome, email: guestEmail },
      });
      toast(
        outcome === 'success' ? 'TEST payment marked successful' : 'TEST payment marked failed',
        outcome === 'success' ? 'success' : 'error'
      );
      if (outcome === 'success') {
        router.push(result.redirect);
      } else {
        setPhase('failed');
        setError('Simulated failure (TEST mode). You can retry - no real money is involved.');
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Test simulator unavailable.');
    } finally {
      setTestOutcomeBusy(null);
    }
  }

  return (
    <div className="atelier-panel overflow-hidden">
      <div className="border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-accent-400">
          {phase === 'awaiting' || phase === 'submitting' ? 'Scan & pay' : 'Payment'}
        </p>
        <p className="mt-1 text-[13px] text-ink-400">
          Order <span className="font-medium text-ink-800">{orderNumber}</span>
        </p>
      </div>

      <div className="p-5 sm:p-6">
        {phase === 'idle' && (
          <div className="space-y-4">
            {error && <Alert tone="warning">{error}</Alert>}
            <p className="text-sm leading-relaxed text-ink-400">
              Pay <strong className="tabular-nums text-ink-900">{formatINR(amountPaise)}</strong>{' '}
              with any UPI app — Google Pay, PhonePe, Paytm, your bank app. You will get a QR code
              and one short confirmation step. No card details ever touch this store.
            </p>
            <Button size="lg" className="w-full" onClick={start}>
              Show UPI QR · {formatINR(amountPaise)}
            </Button>
            <p className="text-center text-[11px] text-ink-500">
              You can also{' '}
              <Link href={confirmationHref} className="link-primary">
                view this order
              </Link>{' '}
              and pay later — it stays reserved.
            </p>
          </div>
        )}

        {phase === 'starting' && (
          <div className="flex flex-col items-center gap-3 py-8" role="status" aria-live="polite">
            <Spinner className="h-7 w-7 text-accent-400" />
            <p className="text-sm text-ink-400">Preparing your QR code…</p>
          </div>
        )}

        {(phase === 'awaiting' || phase === 'submitting') && data && (
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative rounded-2xl bg-white p-3 shadow-[0_0_0_1px_rgba(198,173,122,0.35),0_24px_60px_-24px_rgba(198,173,122,0.45)]">
                <Image
                  src={data.qrDataUrl ?? ''}
                  alt={`UPI QR code to pay ${formatINR(amountPaise)} for order ${orderNumber}`}
                  width={232}
                  height={232}
                  unoptimized
                  className="h-[232px] w-[232px] max-w-full"
                />
                <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-[0.22em] text-accent-500/80">
                  Pay exactly
                </p>
                <p className="mt-1 text-[2rem] font-medium leading-none tracking-[-0.04em] tabular-nums text-ink-900">
                  {formatINR(amountPaise)}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  to {data.upiPayeeName ?? data.storeName} · order {orderNumber}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-[0.2em] text-ink-500">UPI ID</p>
                <p className="truncate font-mono text-sm text-ink-800">{data.upiVpa}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={copyVpa}>
                  {copied ? 'Copied' : 'Copy UPI ID'}
                </Button>
                <a
                  href={data.upiUri ?? '#'}
                  className="inline-flex items-center rounded-lg border border-accent-400/40 px-3 py-1.5 text-sm font-medium text-accent-300 hover:bg-accent-400/10"
                >
                  Open UPI app
                </a>
              </div>
            </div>

            <ol className="grid gap-2 text-xs text-ink-400 sm:grid-cols-3">
              {[
                'Scan the QR or tap “Open UPI app”.',
                'Pay the exact amount shown.',
                'Submit the reference number below.',
              ].map((step, i) => (
                <li
                  key={step}
                  className="flex gap-2 rounded-lg border border-white/[0.06] px-3 py-2 leading-relaxed"
                >
                  <span className="tabular-nums text-accent-500/80">0{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <form onSubmit={submitUtr} className="space-y-3" noValidate>
              <label
                htmlFor="upi-utr"
                className="block text-[10px] font-medium uppercase tracking-[0.2em] text-ink-400"
              >
                UPI reference / UTR
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="upi-utr"
                  value={utr}
                  onChange={(e) => {
                    setUtr(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
                    setUtrError(null);
                  }}
                  maxLength={22}
                  placeholder="e.g. 419283746501"
                  autoComplete="off"
                  spellCheck={false}
                  inputMode="text"
                  aria-invalid={Boolean(utrError)}
                  aria-describedby={utrError ? 'upi-utr-error' : 'upi-utr-hint'}
                  className="font-mono tracking-wide"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="shrink-0"
                  loading={phase === 'submitting'}
                  disabled={utr.length < 8}
                >
                  I&apos;ve paid
                </Button>
              </div>
              {utrError ? (
                <p id="upi-utr-error" role="alert" className="text-xs font-medium text-red-400">
                  {utrError}
                </p>
              ) : (
                <p id="upi-utr-hint" className="text-[11px] leading-relaxed text-ink-500">
                  The 12-digit reference is printed on the success screen of your UPI app. We match
                  it to the store bank account — usually within one business day — and email you the
                  moment the order is confirmed.
                </p>
              )}
            </form>

            <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-[11px] leading-relaxed text-amber-500">
              Only pay if the payee name reads {data.upiPayeeName ?? data.storeName} and the amount
              matches. If anything looks wrong, stop and{' '}
              <Link href="/contact" className="underline">
                contact us
              </Link>
              .
            </p>
          </div>
        )}

        {phase === 'submitted' && (
          <div className="space-y-4 py-2 text-center" role="status" aria-live="polite">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-accent-400/40 bg-accent-400/10 text-accent-300">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-ink-900">Reference received</h2>
            <p className="mx-auto max-w-md text-sm leading-relaxed text-ink-400">
              We saved reference <strong className="font-mono text-ink-700">{utr}</strong> for order{' '}
              {orderNumber}. Once the bank credit is matched, the order is confirmed and you will
              get an email. Nothing else is needed from you.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={() => router.push(confirmationHref)}>View order status</Button>
              <Link
                href="/shop"
                className="rounded-lg border border-white/[0.12] px-4 py-2 text-center text-sm font-medium text-ink-700 hover:bg-white/[0.04]"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        )}

        {phase === 'test-panel' && (
          <div className="space-y-4">
            <Alert tone="warning" title="TEST payment mode">
              This store has no live payment method configured. The TEST provider runs the exact
              same order pipeline but <strong>no real money moves</strong>. This panel never appears
              in production.
            </Alert>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                variant="success"
                size="lg"
                onClick={() => simulateTest('success')}
                loading={testOutcomeBusy === 'success'}
                disabled={testOutcomeBusy !== null}
              >
                Simulate successful payment
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => simulateTest('failure')}
                loading={testOutcomeBusy === 'failure'}
                disabled={testOutcomeBusy !== null}
              >
                Simulate failed payment
              </Button>
            </div>
          </div>
        )}

        {phase === 'failed' && (
          <div className="space-y-4">
            <Alert tone="error" title="Payment not completed">
              {error ?? 'The payment could not be completed.'}
            </Alert>
            <p className="text-sm leading-relaxed text-ink-400">
              Your order <strong className="text-ink-800">{orderNumber}</strong> is saved. Nothing
              has been charged unless your bank shows a debit — in that case do not pay again, and
              contact support with the reference.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button size="lg" onClick={start} className="flex-1">
                Try again
              </Button>
              <Link
                href="/contact"
                className="flex-1 rounded-lg border border-white/[0.12] px-4 py-2.5 text-center text-sm font-medium text-ink-700 hover:bg-white/[0.04]"
              >
                Contact support
              </Link>
            </div>
          </div>
        )}

        {phase === 'pending' && (
          <div className="space-y-4">
            <Alert tone="info" title="Payment is being confirmed">
              Your payment is still being confirmed. This usually resolves within a few minutes — we
              will email you as soon as it is. Please do not pay again.
            </Alert>
            <Button variant="outline" className="w-full" onClick={() => router.push(confirmationHref)}>
              View order status
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
