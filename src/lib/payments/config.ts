import { UPI_VPA_PATTERN, env, isUpiConfigured, upiPayeeName } from '../env';

/**
 * UPI payee resolution.
 *
 * The store's UPI ID can come from two places:
 *   1. `UPI_VPA` in the environment (deployment-level override), or
 *   2. the admin-editable store setting `payments.upiVpa`.
 *
 * The environment wins when both are set, because it is the operator-level
 * configuration. The setting exists so the owner can switch UPI QR payments
 * on from Admin → Settings on a live deployment, with no redeploy.
 *
 * Nothing here touches the database, so it stays cheap and unit-testable.
 */

export interface UpiConfig {
  vpa: string;
  payeeName: string;
  source: 'env' | 'settings';
}

/** Shape of the settings slice this module needs (structural, no DB import). */
export interface UpiSettingsSlice {
  upiVpa?: string | null;
  upiPayeeName?: string | null;
}

/** A trimmed, shape-valid UPI ID, or null when unusable. */
export function normalizeUpiVpa(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return UPI_VPA_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Resolve the payee the store can actually collect into, or null when neither
 * source is configured. An empty or malformed value is treated as absent so the
 * store never renders a QR that pays nobody.
 */
export function resolveUpiConfig(settings?: UpiSettingsSlice | null): UpiConfig | null {
  if (isUpiConfigured() && env.UPI_VPA) {
    return { vpa: env.UPI_VPA, payeeName: upiPayeeName(), source: 'env' };
  }
  const vpa = normalizeUpiVpa(settings?.upiVpa);
  if (!vpa) return null;
  const payeeName = settings?.upiPayeeName?.trim() || env.APP_NAME;
  return { vpa, payeeName, source: 'settings' };
}

/** Why UPI is unavailable, phrased for the owner (never shown to customers). */
export function upiUnavailableReason(settings?: UpiSettingsSlice | null): string {
  const configured = settings?.upiVpa?.trim();
  if (configured && !normalizeUpiVpa(configured)) {
    return 'The store UPI ID in Admin → Settings → Payments is not a valid UPI ID (expected name@bank).';
  }
  return 'No store UPI ID is set. Add it in Admin → Settings → Payments, or set UPI_VPA in the environment.';
}
