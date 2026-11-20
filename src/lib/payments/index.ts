import { isTestPaymentsAllowed } from '../env';
import { logger } from '../logger';
import { getSettings } from '../settings';
import {
  resolveUpiConfig,
  upiUnavailableReason,
  type UpiConfig,
  type UpiSettingsSlice,
} from './config';
import { TestPaymentAdapter } from './test-provider';
import { UpiQrAdapter } from './upi';
import type { PaymentProviderAdapter } from './types';

/**
 * Provider selection:
 *   1. UPI QR — whenever a store UPI ID is resolved (env `UPI_VPA`, or the
 *      admin-editable `payments.upiVpa` setting). Real money, confirmed
 *      manually against the bank statement.
 *   2. TEST provider — only when PAYMENTS_TEST_MODE=true and NOT production.
 *   3. null - checkout must then refuse payments with an honest, actionable
 *      error (never silently pretend). COD remains available.
 */
export function providerFromConfig(upi: UpiConfig | null): PaymentProviderAdapter | null {
  if (upi) return new UpiQrAdapter(upi);
  if (isTestPaymentsAllowed()) return new TestPaymentAdapter();
  return null;
}

/** Resolve the live provider for this request (reads settings, so async). */
export async function getPaymentProvider(): Promise<PaymentProviderAdapter | null> {
  const settings = await getSettings().catch(() => null);
  const provider = providerFromConfig(resolveUpiConfig(settings?.payments));
  if (!provider) {
    logger.error('No payment provider available', {
      reason: upiUnavailableReason(settings?.payments),
      testModeAllowed: isTestPaymentsAllowed(),
    });
  }
  return provider;
}

export interface PaymentStatusDescription {
  kind: 'UPI' | 'TEST' | 'NONE';
  label: string;
  isTest: boolean;
  /** Public payee address (never a secret) when UPI is live. */
  upiVpa: string | null;
  /** Owner-facing reason when no provider is usable. */
  issue: string | null;
}

/**
 * Synchronous description for pages that already loaded settings, so a single
 * request never reads the store settings twice.
 */
export function describePaymentProvider(
  upi: UpiConfig | null,
  settings?: UpiSettingsSlice | null
): PaymentStatusDescription {
  if (upi) {
    return {
      kind: 'UPI',
      label: 'UPI QR',
      isTest: false,
      upiVpa: upi.vpa,
      issue: null,
    };
  }
  if (isTestPaymentsAllowed()) {
    return {
      kind: 'TEST',
      label: 'TEST provider (development only)',
      isTest: true,
      upiVpa: null,
      issue: null,
    };
  }
  return {
    kind: 'NONE',
    label: 'Not configured',
    isTest: false,
    upiVpa: null,
    issue: upiUnavailableReason(settings),
  };
}

/** Convenience for async server components without settings in scope. */
export async function loadPaymentStatus(): Promise<PaymentStatusDescription> {
  const settings = await getSettings().catch(() => null);
  return describePaymentProvider(resolveUpiConfig(settings?.payments), settings?.payments);
}

export type { UpiConfig };
export { resolveUpiConfig } from './config';
export * from './types';
