import { describe, expect, it } from 'vitest';
import { collectLaunchReadiness } from '@/lib/ops/launch-blockers';

const business = { legalName: '', gstin: '', addressLine: '', city: '', state: '', postalCode: '' };
const prodEnv = {
  NODE_ENV: 'production',
  EMAIL_PROVIDER: 'smtp',
  CRON_SECRET: 'x',
  UPI_VPA: undefined,
  STORAGE_PROVIDER: 'local',
  SUPPORT_EMAIL: 'owner@mailbox.test',
  SMTP_HOST: 'smtp.mailprovider.com',
  EMAIL_FROM: 'Zenvora <no-reply@zenvora.in>',
};

describe('collectLaunchReadiness', () => {
  it('flags the shipped placeholder support e-mail, demo mode and missing payments in production', () => {
    const r = collectLaunchReadiness({
      settings: { demoMode: true, supportEmail: 'support@example.com', business },
      env: prodEnv,
      paymentConfigured: false,
    });
    expect(r.blockers).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/No payment method configured/),
        expect.stringMatching(/Demo mode is ON/),
        expect.stringMatching(/placeholder/),
      ])
    );
    expect(r.configGaps.join(' ')).toMatch(/Business details missing: legal\/trading name, principal address, GSTIN/);
    expect(r.configGaps.join(' ')).toMatch(/STORAGE_PROVIDER is local/);
  });

  it('an env-fallback support address clears the blocker but is reported as a gap until saved', () => {
    const r = collectLaunchReadiness({
      settings: { demoMode: false, supportEmail: 'owner@mailbox.test', business },
      env: prodEnv,
      paymentConfigured: true,
    });
    expect(r.blockers.join(' ')).not.toMatch(/placeholder|Demo mode|No payment method configured/);
    expect(r.configGaps).toEqual(
      expect.arrayContaining([expect.stringMatching(/SUPPORT_EMAIL environment fallback/)])
    );
  });

  it('is quiet when everything is configured', () => {
    const r = collectLaunchReadiness({
      settings: {
        demoMode: false,
        supportEmail: 'help@store.test',
        business: { ...business, legalName: 'Zenvora', addressLine: '1 Road', gstin: '18ABCDE1234F1Z5' },
      },
      env: { ...prodEnv, UPI_VPA: 'zenvora@ybl', STORAGE_PROVIDER: 's3' },
      paymentConfigured: true,
    });
    expect(r.blockers).toEqual([]);
    expect(r.configGaps).toEqual([]);
  });

  it('flags undeliverable sending domains and a missing SMTP host in production', () => {
    const r = collectLaunchReadiness({
      settings: { demoMode: false, supportEmail: 'help@store.test', business },
      env: { ...prodEnv, EMAIL_FROM: 'Zenvora <no-reply@zenvora.local>', SMTP_HOST: undefined },
      paymentConfigured: true,
    });
    expect(r.blockers.join(' ')).toMatch(/SMTP_HOST is empty/);
    expect(r.blockers.join(' ')).toMatch(/EMAIL_FROM uses a reserved\/internal domain/);
  });

  it('outside production only CRON_SECRET and the placeholder are blockers', () => {
    const r = collectLaunchReadiness({
      settings: { demoMode: true, supportEmail: 'support@example.com', business },
      env: { ...prodEnv, NODE_ENV: 'development', CRON_SECRET: undefined, EMAIL_PROVIDER: 'console' },
      paymentConfigured: false,
    });
    expect(r.blockers).toHaveLength(2);
    expect(r.blockers.join(' ')).toMatch(/CRON_SECRET/);
  });
});
