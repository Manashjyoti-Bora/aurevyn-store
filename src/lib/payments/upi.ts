import { randomCode } from '../crypto';
import { logger } from '../logger';
import type { UpiConfig } from './config';
import type {
  CreatePaymentOrderInput,
  CreatePaymentOrderResult,
  PaymentProviderAdapter,
  RefundInput,
  RefundResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  WebhookValidation,
} from './types';

/**
 * UPI QR adapter — no gateway, no API keys, no middleman.
 *
 * The customer scans a QR that encodes an NPCI UPI intent paying the store's
 * own VPA for the exact server-computed amount and order number. They then
 * quote the UTR/reference from their UPI app; an admin matches it against the
 * bank statement and marks the order paid.
 *
 * Security properties:
 *   - Amounts always come from the stored order, never from the browser.
 *   - This adapter NEVER returns PAID. Only a human bank reconciliation (or
 *     the admin confirm endpoint) can move an order to paid — a forged browser
 *     response cannot capture an order.
 *   - Refunds are manual by design (bank/UPI transfer recorded by an admin).
 */

/** NPCI UPI deep link. Encodes only public payment details. */
export function buildUpiUri(input: {
  vpa: string;
  payeeName: string;
  amountPaise: number;
  orderNumber: string;
  note?: string;
}): string {
  const amount = (input.amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: input.vpa,
    pn: input.payeeName.slice(0, 80),
    am: amount,
    cu: 'INR',
    tn: (input.note ?? `Order ${input.orderNumber}`).slice(0, 80),
  });
  return `upi://pay?${params.toString()}`;
}

export class UpiQrAdapter implements PaymentProviderAdapter {
  readonly kind = 'UPI' as const;
  readonly label = 'UPI QR';

  constructor(private readonly config: UpiConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.vpa);
  }

  async createPaymentOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult> {
    return {
      provider: this.kind,
      providerOrderId: `upi_${randomCode(16)}`,
      amountPaise: input.amountPaise,
      currency: input.currency,
      checkoutMode: 'upi-qr',
      upiUri: buildUpiUri({
        vpa: this.config.vpa,
        payeeName: this.config.payeeName,
        amountPaise: input.amountPaise,
        orderNumber: input.orderNumber,
      }),
      notes: {
        vpa: this.config.vpa,
        payeeName: this.config.payeeName,
      },
    };
  }

  /**
   * There is no gateway to ask. A bank transfer is confirmed by a human, so
   * automated verification always reports PENDING and never PAID.
   */
  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    logger.info('UPI payment requires manual reconciliation; reporting PENDING', {
      providerOrderId: input.providerOrderId,
    });
    return {
      outcome: 'PENDING',
      providerPaymentId: input.providerPaymentId,
      verifiedVia: 'upi-utr',
    };
  }

  async validateWebhook(
    _rawBody: string,
    _signatureHeader: string | null
  ): Promise<WebhookValidation> {
    return { valid: false, reason: 'UPI QR payments deliver no webhooks' };
  }

  /**
   * Manual by design. Returning an explicit `manual` marker lets the refund
   * pipeline park the reservation in a human queue instead of treating the
   * absence of a provider refund id as an ambiguous gateway outcome.
   */
  async refund(_input: RefundInput): Promise<RefundResult> {
    return {
      providerRefundId: null,
      status: 'MANUAL',
      failureReason: 'UPI refunds are paid out by the store owner (bank/UPI transfer).',
    };
  }
}
