import { describe, expect, it } from 'vitest';
import { buildTeamBriefings } from '@/lib/team/briefings';
import { TEAM_ROSTER, TEAM_IDS } from '@/lib/team/roster';
import type { TeamSignals } from '@/lib/team/types';

const AS_OF = '2026-11-21T12:00:00.000Z';

function signals(overrides: Partial<TeamSignals> = {}): TeamSignals {
  const base: TeamSignals = {
    asOf: AS_OF,
    windowDays: 30,
    store: {
      name: 'Nirvora',
      demoMode: false,
      paymentsKind: 'UPI',
      paymentsConfigured: true,
      cronConfigured: true,
      emailLive: true,
      storageDurable: true,
      supportEmailConfigured: true,
      businessComplete: true,
    },
    catalog: {
      active: 12,
      draft: 0,
      archived: 0,
      categoriesActive: 4,
      categoriesEmpty: 0,
      missingImage: 0,
      lowStock: 0,
      outOfStock: 0,
      stale: 0,
      withoutSupplierLink: 0,
      belowCost: 0,
      thinMargin: 0,
    },
    orders: {
      awaitingFulfilment: 0,
      overdueDispatch: 0,
      inTransit: 0,
      deliveredWindow: 3,
      cancelledWindow: 0,
      placedWindow: 5,
      staleUnpaid: 0,
      revenueWindowPaise: 250_000,
      refundedWindowPaise: 0,
    },
    payments: { awaitingVerification: 0, failedWindow: 0 },
    refunds: { requested: 0, processing: 0 },
    returns: { open: 0 },
    support: { newMessages: 0, oldestNewAt: null },
    jobs: { pending: 0, failed: 0, oldestPendingAt: null },
    reviews: { published: 2, pending: 0, productsWithoutReview: 10 },
    suppliers: { active: 1, inactive: 0, unmapped: 0, failingSync: 0 },
    coupons: { expiringSoon: 0 },
    launch: { blockers: [], configGaps: [] },
  };
  return { ...base, ...overrides };
}

function byId(list: ReturnType<typeof buildTeamBriefings>, id: string) {
  const briefing = list.find((entry) => entry.agentId === id);
  if (!briefing) throw new Error(`Missing briefing for ${id}`);
  return briefing;
}

describe('team roster', () => {
  it('has eight uniquely identified agents, each with a mandate and guardrails', () => {
    expect(TEAM_ROSTER).toHaveLength(8);
    expect(new Set(TEAM_IDS).size).toBe(8);
    for (const agent of TEAM_ROSTER) {
      expect(agent.mandate.length).toBeGreaterThan(10);
      expect(agent.decides.length).toBeGreaterThan(0);
      expect(agent.escalates.length).toBeGreaterThan(0);
      expect(agent.schedule.cron).toMatch(/^\d+ \*\/\d+ \* \* \*$/);
    }
  });

  it('never lets an agent start a publish, reprice, refund or reply', () => {
    const forbiddenVerb = /^(publish|price|reprice|refund|delete|cancel|reply|message)\b/i;
    for (const agent of TEAM_ROSTER) {
      for (const decision of agent.decides) {
        expect(decision).not.toMatch(forbiddenVerb);
      }
    }
  });
});

describe('team briefings', () => {
  it('produces one briefing per agent and sorts urgent work first', () => {
    const briefings = buildTeamBriefings(signals());
    expect(briefings).toHaveLength(8);
    const rank = { ACT: 0, WATCH: 1, CLEAR: 2 } as const;
    const ranks = briefings.map((b) => rank[b.status]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('is deterministic for the same signals', () => {
    expect(buildTeamBriefings(signals())).toEqual(buildTeamBriefings(signals()));
  });

  it('says the catalogue is empty instead of reporting success', () => {
    const briefings = buildTeamBriefings(
      signals({
        catalog: { ...signals().catalog, active: 0, categoriesActive: 0, categoriesEmpty: 3 },
      })
    );
    const vesper = byId(briefings, 'vesper');
    expect(vesper.status).toBe('ACT');
    expect(vesper.headline).toContain('empty');
  });

  it('raises pricing when a product sells below landed cost', () => {
    const briefings = buildTeamBriefings(
      signals({ catalog: { ...signals().catalog, belowCost: 2 } })
    );
    const kaizen = byId(briefings, 'kaizen');
    expect(kaizen.status).toBe('ACT');
    expect(kaizen.headline).toContain('2 live products');
    expect(kaizen.priorities.join(' ')).toMatch(/below landed cost/);
  });

  it('raises fulfilment when a paid order is overdue', () => {
    const briefings = buildTeamBriefings(
      signals({ orders: { ...signals().orders, overdueDispatch: 1 } })
    );
    expect(byId(briefings, 'atlas').status).toBe('ACT');
    expect(byId(briefings, 'atlas').headline).toContain('not dispatched');
    expect(byId(briefings, 'anchor').status).toBe('ACT');
  });

  it('raises finance when a UPI payment awaits bank verification', () => {
    const briefings = buildTeamBriefings(
      signals({ payments: { awaitingVerification: 1, failedWindow: 0 } })
    );
    const ledger = byId(briefings, 'ledger');
    expect(ledger.status).toBe('ACT');
    expect(ledger.headline).toContain('bank verification');
    expect(ledger.summary).toContain('no agent moves money');
  });

  it('keeps review trust honest when delivered orders have no reviews yet', () => {
    const briefings = buildTeamBriefings(
      signals({ reviews: { published: 0, pending: 0, productsWithoutReview: 12 } })
    );
    const lumen = byId(briefings, 'lumen');
    expect(lumen.status).toBe('WATCH');
    expect(lumen.priorities.join(' ')).toMatch(/verified review/i);
  });

  it('turns owner-only launch blockers into Orion action items', () => {
    const briefings = buildTeamBriefings(
      signals({
        launch: {
          blockers: ['No payment method configured — set UPI_VPA or enable Cash on Delivery'],
          configGaps: [],
        },
      })
    );
    const orion = byId(briefings, 'orion');
    expect(orion.status).toBe('ACT');
    expect(orion.priorities[0]).toContain('No payment method configured');
  });

  it('reports a clean store as clear rather than inventing work', () => {
    const briefings = buildTeamBriefings(
      signals({
        reviews: { published: 3, pending: 0, productsWithoutReview: 0 },
        catalog: { ...signals().catalog, active: 20, categoriesActive: 5 },
      })
    );
    expect(byId(briefings, 'orion').status).toBe('CLEAR');
    expect(byId(briefings, 'anchor').status).toBe('CLEAR');
    for (const briefing of briefings) {
      if (briefing.status === 'CLEAR') expect(briefing.priorities).toHaveLength(0);
    }
  });

  it('labels every finding with an evidence basis', () => {
    for (const briefing of buildTeamBriefings(signals())) {
      expect(briefing.findings.length).toBeGreaterThan(0);
      for (const finding of briefing.findings) {
        expect(['VERIFIED', 'DERIVED']).toContain(finding.basis);
        expect(finding.value.length).toBeGreaterThan(0);
      }
    }
  });
});
