import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * UPI QR configuration gate.
 *  - no UPI_VPA            => QR payments unavailable (checkout stays COD-only)
 *  - valid UPI_VPA         => QR payments available
 *  - TEST provider remains hard-disabled in production regardless of flags
 *  - the UPI intent carries the exact server amount and the order number
 */

const SAFE_KEYS = ['NODE_ENV', 'UPI_VPA', 'UPI_PAYEE_NAME', 'PAYMENTS_TEST_MODE', 'DATABASE_URL'];
const ORIGINAL: Record<string, string | undefined> = {};
for (const k of SAFE_KEYS) ORIGINAL[k] = process.env[k];

async function loadEnvModule(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const k of SAFE_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) process.env[k] = v;
  }
  return import('@/lib/env');
}

afterEach(() => {
  vi.resetModules();
  for (const k of SAFE_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v !== undefined) process.env[k] = v;
  }
});

const base = { DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:5432/unused' };

describe('UPI QR configuration', () => {
  it('reports QR payments unavailable without a UPI ID', async () => {
    const mod = await loadEnvModule({ ...base, NODE_ENV: 'production' });
    expect(mod.isUpiConfigured()).toBe(false);
    expect(mod.upiConfigIssue()).toMatch(/UPI_VPA/);
  });

  it('accepts a valid store UPI ID', async () => {
    const mod = await loadEnvModule({
      ...base,
      NODE_ENV: 'production',
      UPI_VPA: 'aurevyn.store@okhdfcbank',
    });
    expect(mod.isUpiConfigured()).toBe(true);
    expect(mod.upiConfigIssue()).toBeNull();
  });

  it('refuses a malformed UPI ID at startup', async () => {
    await expect(
      loadEnvModule({ ...base, NODE_ENV: 'production', UPI_VPA: 'not-a-vpa' })
    ).rejects.toThrow(/UPI_VPA/);
  });

  it('falls back to the app name as the payee name', async () => {
    const mod = await loadEnvModule({
      ...base,
      NODE_ENV: 'production',
      UPI_VPA: 'aurevyn@ybl',
      APP_NAME: 'Aurevyn',
    });
    expect(mod.upiPayeeName()).toBe('Aurevyn');
  });

  it('never allows the TEST provider in production', async () => {
    const mod = await loadEnvModule({
      ...base,
      NODE_ENV: 'production',
      PAYMENTS_TEST_MODE: 'true',
    });
    expect(mod.isTestPaymentsAllowed()).toBe(false);
  });
});

describe('UPI payee resolution (environment vs admin setting)', () => {
  it('uses the store setting when no environment override exists', async () => {
    await loadEnvModule({ ...base, NODE_ENV: 'production', APP_NAME: 'Aurevyn' });
    const { resolveUpiConfig } = await import('@/lib/payments/config');
    const config = resolveUpiConfig({ upiVpa: 'store@ptaxis', upiPayeeName: '' });
    expect(config).toEqual({ vpa: 'store@ptaxis', payeeName: 'Aurevyn', source: 'settings' });
  });

  it('lets the environment override the stored setting', async () => {
    await loadEnvModule({
      ...base,
      NODE_ENV: 'production',
      UPI_VPA: 'env@ybl',
      UPI_PAYEE_NAME: 'Env Store',
    });
    const { resolveUpiConfig } = await import('@/lib/payments/config');
    const config = resolveUpiConfig({ upiVpa: 'setting@ptaxis', upiPayeeName: 'Setting Store' });
    expect(config).toEqual({ vpa: 'env@ybl', payeeName: 'Env Store', source: 'env' });
  });

  it('treats a blank or malformed stored UPI ID as absent', async () => {
    await loadEnvModule({ ...base, NODE_ENV: 'production' });
    const { resolveUpiConfig, upiUnavailableReason } = await import('@/lib/payments/config');
    expect(resolveUpiConfig({ upiVpa: '   ' })).toBeNull();
    expect(resolveUpiConfig({ upiVpa: 'not-a-vpa' })).toBeNull();
    expect(resolveUpiConfig(null)).toBeNull();
    expect(upiUnavailableReason({ upiVpa: 'not-a-vpa' })).toMatch(/not a valid UPI ID/);
  });
});

describe('UPI intent', () => {
  it('encodes the payable amount in rupees and the order note', async () => {
    const { buildUpiUri } = await import('@/lib/payments/upi');
    const uri = buildUpiUri({
      vpa: 'aurevyn@ybl',
      payeeName: 'Aurevyn',
      amountPaise: 129900,
      orderNumber: 'ZV-1001',
    });
    expect(uri.startsWith('upi://pay?')).toBe(true);
    const params = new URLSearchParams(uri.slice('upi://pay?'.length));
    expect(params.get('pa')).toBe('aurevyn@ybl');
    expect(params.get('pn')).toBe('Aurevyn');
    expect(params.get('am')).toBe('1299.00');
    expect(params.get('cu')).toBe('INR');
    expect(params.get('tn')).toBe('Order ZV-1001');
  });
});
