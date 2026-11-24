import { describe, it, expect } from 'vitest';
import {
  DAY_MS,
  NEVER_PRUNED,
  RETENTION_POLICIES,
  buildRetentionPlan,
  personalDataDatasets,
  retentionCutoff,
} from '@/lib/privacy/retention';

const NOW = new Date('2026-11-24T12:00:00.000Z');

describe('retention policy', () => {
  it('gives every dataset a unique name and a positive whole-day period', () => {
    const datasets = RETENTION_POLICIES.map((p) => p.dataset);
    expect(new Set(datasets).size).toBe(datasets.length);
    for (const policy of RETENTION_POLICIES) {
      expect(Number.isInteger(policy.retainDays)).toBe(true);
      expect(policy.retainDays).toBeGreaterThan(0);
      expect(policy.why.length).toBeGreaterThan(20);
    }
  });

  it('never includes a business or money record in the pruning plan', () => {
    const datasets = RETENTION_POLICIES.map((p) => p.dataset).join(' ');
    expect(datasets).not.toContain('order');
    expect(datasets).not.toContain('payment');
    expect(datasets).not.toContain('refund');
    expect(datasets).not.toContain('supplier');
    expect(NEVER_PRUNED.length).toBeGreaterThan(0);
  });

  it('keeps the audit trail longer than diagnostics', () => {
    const audit = RETENTION_POLICIES.find((p) => p.dataset === 'audit_logs')!;
    const errors = RETENTION_POLICIES.find((p) => p.dataset === 'error_logs')!;
    expect(audit.retainDays).toBeGreaterThan(errors.retainDays);
  });

  it('computes an exact cutoff in whole days', () => {
    expect(retentionCutoff({ retainDays: 30 }, NOW).toISOString()).toBe(
      new Date(NOW.getTime() - 30 * DAY_MS).toISOString()
    );
    expect(retentionCutoff({ retainDays: 1 }, NOW).getTime()).toBe(NOW.getTime() - DAY_MS);
  });

  it('builds one plan step per policy, in policy order, all before now', () => {
    const plan = buildRetentionPlan(NOW);
    expect(plan.map((s) => s.dataset)).toEqual(RETENTION_POLICIES.map((p) => p.dataset));
    for (const step of plan) {
      expect(step.deleteBefore.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it('flags exactly the datasets that can identify a person', () => {
    expect(personalDataDatasets().sort()).toEqual([
      'api_logs',
      'audit_logs',
      'contact_messages',
      'error_logs',
      'webhook_events',
    ]);
  });
});
