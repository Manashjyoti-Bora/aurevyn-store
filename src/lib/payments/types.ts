/**
 * Payment provider abstraction.
 *
 * Adding a gateway later (e.g. Cashfree, PayU, Stripe) means implementing
 * this interface and registering it in `index.ts` - nothing else changes.
 */

export type PaymentProviderKind = 'UPI' | 'TEST';

export interface CreatePaymentOrderInput {
  orderId: string;
  orderNumber: string;
  amountPaise: number;
  currency: string;
  customer?: { name?: string; email?: string; phone?: string };
}

export type CheckoutMode = 'upi-qr' | 'test-simulator' | 'unconfigured';

export interface CreatePaymentOrderResult {
  provider: PaymentProviderKind;
  providerOrderId: string;
  amountPaise: number;
  currency: string;
  checkoutMode: CheckoutMode;
  /** NPCI UPI deep link the QR encodes (public payment details only). */
  upiUri?: string;
  notes?: Record<string, string>;
}

export type PaymentOutcome = 'PAID' | 'FAILED' | 'PENDING';
export type PaymentResultOutcome = Exclude<PaymentOutcome, 'PENDING'>;
export type PaymentRecordStatus = 'CREATED' | 'PAID' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';

const CAPTURED_PAYMENT_STATUSES: readonly PaymentRecordStatus[] = [
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
];

/**
 * Captured and refunded payment states must never be erased by an out-of-order
 * gateway delivery. PAID may be repeated for crash recovery, but a failure is
 * valid only before capture and neither outcome may rewrite a refund state.
 */
export const PAYMENT_RESULT_ELIGIBLE_STATUSES: Record<
  PaymentResultOutcome,
  readonly PaymentRecordStatus[]
> = {
  PAID: ['CREATED', 'FAILED', 'PAID'],
  FAILED: ['CREATED', 'FAILED'],
};

export function isCapturedPaymentStatus(
  status: string
): status is 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED' {
  return (CAPTURED_PAYMENT_STATUSES as readonly string[]).includes(status);
}

export function canApplyPaymentResultToStatus(
  status: PaymentRecordStatus,
  outcome: PaymentResultOutcome
): boolean {
  return PAYMENT_RESULT_ELIGIBLE_STATUSES[outcome].includes(status);
}

export interface VerifyPaymentInput {
  providerOrderId: string;
  providerPaymentId?: string;
  signature?: string;
  /** Expected amount for a server-side double-check (paise). */
  expectedAmountPaise?: number;
}

export interface VerifyPaymentResult {
  outcome: PaymentOutcome;
  providerPaymentId?: string;
  method?: string;
  feePaise?: number | null;
  failureReason?: string;
  /** How the verification was established (audit trail). */
  verifiedVia:
    | 'gateway-fetch+signature'
    | 'gateway-fetch'
    | 'signature'
    | 'upi-utr'
    | 'manual-admin';
  raw?: Record<string, unknown>;
}

export interface RefundInput {
  providerPaymentId: string;
  amountPaise: number;
  reason?: string;
  /** Local durable reservation id for provider-side reconciliation metadata. */
  refundId?: string;
}

export interface RefundResult {
  providerRefundId: string | null;
  /**
   * MANUAL means the store settles this refund itself (UPI has no refund API):
   * the reservation stays parked for an admin instead of being treated as an
   * ambiguous gateway outcome.
   */
  status: 'MANUAL' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failureReason?: string;
  raw?: Record<string, unknown>;
}

export interface WebhookValidation {
  valid: boolean;
  reason?: string;
}

export interface PaymentProviderAdapter {
  readonly kind: PaymentProviderKind;
  readonly label: string;
  isConfigured(): boolean;
  createPaymentOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  /** Validate an incoming webhook request (signature/shared secret). */
  validateWebhook(rawBody: string, signatureHeader: string | null): Promise<WebhookValidation>;
}

/** Thrown when no payment provider is usable (missing credentials). */
export class PaymentsNotConfiguredError extends Error {
  constructor() {
    super(
      'No payment provider is configured. Set UPI_VPA (production) or enable PAYMENTS_TEST_MODE (development only). See docs/PAYMENT_SETUP.md.'
    );
    this.name = 'PaymentsNotConfiguredError';
  }
}
