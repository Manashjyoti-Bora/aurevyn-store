import { describe, it, expect } from 'vitest';
import { buildDailyReport, type DailyReportInput } from '@/lib/jarvis/report';

const base: DailyReportInput = {
  day: '2026-11-22',
  ordersPlaced: 4,
  ordersPaid: 3,
  codOrders: 1,
  paymentsCollectedPaise: 149_700,
  orderValuePlacedPaise: 199_600,
  cancelledToday: 0,
  refundsCompletedPaise: 0,
  refundsRequested: 1,
  estimatedProfitPaise: 42_000,
  realisedProfitPaise: 0,
  finalisedOrders: 0,
  awaitingPlacement: 2,
  unverifiedReferences: 1,
  draftsAwaitingReview: 5,
  newCandidates: 3,
  supportMessagesNew: 1,
  openIncidents: 1,
  failedJobs: 2,
};

function metric(report: ReturnType<typeof buildDailyReport>, key: string) {
  for (const section of report.sections) {
    const found = section.metrics.find((m) => m.key === key);
    if (found) return found;
  }
  throw new Error(`metric ${key} not found`);
}

describe('daily report', () => {
  it('labels collected money as verified and profit as an estimate', () => {
    const report = buildDailyReport(base);
    expect(metric(report, 'collected').basis).toBe('VERIFIED');
    expect(metric(report, 'estimated-profit').basis).toBe('ESTIMATE');
    expect(metric(report, 'order-value').basis).toBe('VERIFIED');
  });

  it('shows realised profit as UNKNOWN when no order finalised, not a fake zero', () => {
    const report = buildDailyReport(base);
    const realised = metric(report, 'realised-profit');
    expect(realised.basis).toBe('UNKNOWN');
    expect(realised.note).toContain('unknown');
  });

  it('promotes realised profit to VERIFIED only with finalised orders', () => {
    const report = buildDailyReport({ ...base, finalisedOrders: 2, realisedProfitPaise: 12_000 });
    const realised = metric(report, 'realised-profit');
    expect(realised.basis).toBe('VERIFIED');
    expect(realised.value).toBe(12_000);
  });

  it('puts every owner-blocked item in the queue', () => {
    const report = buildDailyReport(base);
    const text = report.ownerQueue.join(' ');
    expect(text).toContain('Meesho');
    expect(text).toContain('unverified');
    expect(text).toContain('refund');
    expect(text).toContain('incident');
  });

  it('does not claim activity on a quiet day', () => {
    const report = buildDailyReport({
      ...base,
      ordersPlaced: 0,
      ordersPaid: 0,
      paymentsCollectedPaise: 0,
      orderValuePlacedPaise: 0,
      estimatedProfitPaise: 0,
      awaitingPlacement: 0,
      unverifiedReferences: 0,
      refundsRequested: 0,
      openIncidents: 0,
      supportMessagesNew: 0,
      draftsAwaitingReview: 0,
      newCandidates: 0,
      failedJobs: 0,
      cancelledToday: 0,
    });
    expect(report.headline).toContain('No orders placed today');
    expect(report.ownerQueue).toEqual([]);
  });
});
