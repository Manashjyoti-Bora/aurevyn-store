import { describe, it, expect } from 'vitest';
import {
  buildReadinessChecks,
  computeReleaseStatus,
  releaseStatusTone,
  statusBlocker,
  type ReadinessCheck,
  type ReadinessInput,
} from '@/lib/jarvis/readiness';

const passed = (id: string): ReadinessCheck => ({
  id,
  label: id,
  state: 'PASSED',
  evidence: 'recorded',
});

describe('release readiness', () => {
  it('returns PLANNED with no checks', () => {
    expect(computeReleaseStatus([])).toBe('PLANNED');
  });

  it('never reports VERIFIED or PRODUCTION READY while anything is unknown', () => {
    const checks = [passed('build'), { id: 'tests', label: 'tests', state: 'UNKNOWN' as const, evidence: 'none' }];
    expect(computeReleaseStatus(checks)).toBe('TESTING');
    expect(computeReleaseStatus(checks, true)).toBe('TESTING');
  });

  it('requires owner sign-off for PRODUCTION READY', () => {
    const checks = [passed('build'), passed('tests')];
    expect(computeReleaseStatus(checks)).toBe('VERIFIED');
    expect(computeReleaseStatus(checks, true)).toBe('PRODUCTION READY');
  });

  it('blocks the label when a check has failed', () => {
    const checks = [
      passed('build'),
      { id: 'backup', label: 'Backup restore', state: 'FAILED' as const, evidence: 'never rehearsed' },
    ];
    expect(computeReleaseStatus(checks)).toBe('BLOCKED');
    expect(statusBlocker(checks)).toContain('Backup restore');
  });

  it('marks unconfigured payments and un-rehearsed backups as failed checks', () => {
    const input: ReadinessInput = {
      buildVerifiedAt: new Date('2026-11-22'),
      testsPassedAt: new Date('2026-11-22'),
      dbReachable: true,
      authTestedAt: null,
      paymentConfigured: false,
      paymentTestedAt: null,
      backupRehearsedAt: null,
      cronConfigured: false,
      incidentsTracked: true,
      policiesReviewedAt: null,
      integrationsDocumented: true,
      ownerSignedOff: false,
    };
    const checks = buildReadinessChecks(input);
    expect(checks.find((c) => c.id === 'payments')!.state).toBe('FAILED');
    expect(checks.find((c) => c.id === 'backup')!.state).toBe('FAILED');
    expect(computeReleaseStatus(checks)).toBe('BLOCKED');

    const withPayment = buildReadinessChecks({ ...input, paymentConfigured: true });
    expect(withPayment.find((c) => c.id === 'payments')!.state).toBe('UNKNOWN');
  });

  it('maps every status to a visible tone', () => {
    for (const status of [
      'PLANNED',
      'IN DEVELOPMENT',
      'TESTING',
      'BLOCKED',
      'VERIFIED',
      'PRODUCTION READY',
    ] as const) {
      expect(releaseStatusTone(status)).toBeTruthy();
    }
  });
});
