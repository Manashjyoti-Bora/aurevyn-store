import { describe, expect, it } from 'vitest';
import { answerFromFacts, detectCofounderIntent } from '@/lib/cofounder/service';
import type { CofounderFacts } from '@/lib/cofounder/types';

function facts(overrides: Partial<CofounderFacts> = {}): CofounderFacts {
  const base: CofounderFacts = {
    storeName: 'Zenvora',
    windowDays: 30,
    headline: 'Trading with 4 paid orders and no critical risk',
    overallLevel: 'OK',
    sales: {
      paidOrders: 4,
      netRevenuePaise: 245000,
      contributionPaise: 62000,
      aovPaise: 61250,
      basis: 'DERIVED',
      caveatCount: 0,
      codCommittedOrders: 1,
    },
    orders: {
      byStatus: { DELIVERED: 3, ORDER_CONFIRMED: 1 },
      pendingPaymentOlderThan24h: 0,
    },
    risks: [],
    recommendations: [],
    launchBlockers: [],
    catalog: {
      activeProducts: 12,
      activeWithoutImage: 0,
      activeWithoutSupplier: 2,
      staleSupplierRows: 0,
      outOfStockSupplierRows: 1,
    },
    carts: { active: 3, stale: 2 },
    inventory: { lowStock: [], outOfStock: [] },
    coupons: { active: 2 },
    support: { open: 0 },
    jobs: { failedLast24h: 0, pending: 0 },
    actionsEnabled: false,
    dailyActionLimit: 20,
    dataGaps: [],
  };
  return {
    ...base,
    ...overrides,
    sales: { ...base.sales, ...(overrides.sales ?? {}) },
    orders: { ...base.orders, ...(overrides.orders ?? {}) },
    catalog: { ...base.catalog, ...(overrides.catalog ?? {}) },
    carts: { ...base.carts, ...(overrides.carts ?? {}) },
    inventory: { ...base.inventory, ...(overrides.inventory ?? {}) },
    jobs: { ...base.jobs, ...(overrides.jobs ?? {}) },
  };
}

describe('detectCofounderIntent', () => {
  it('routes sales, order and stock questions', () => {
    expect(detectCofounderIntent('how much did I sell this month?')).toBe('SALES');
    expect(detectCofounderIntent('any orders stuck?')).toBe('ORDERS');
    expect(detectCofounderIntent('what is low in stock?')).toBe('INVENTORY');
    expect(detectCofounderIntent('any cart abandonments?')).toBe('CARTS');
    expect(detectCofounderIntent('can I run a flash sale?')).toBe('MARKETING');
    expect(detectCofounderIntent('should I launch?')).toBe('LAUNCH');
    expect(detectCofounderIntent('what should I do today?')).toBe('PRIORITIES');
  });

  it('falls back to UNKNOWN for an unrelated question', () => {
    expect(detectCofounderIntent('asdfgh')).toBe('UNKNOWN');
  });
});

describe('answerFromFacts', () => {
  it('reports realised revenue with its evidence basis', () => {
    const answer = answerFromFacts('how are sales?', facts());
    expect(answer.intent).toBe('SALES');
    expect(answer.message).toContain('₹2,450');
    expect(answer.message).toContain('4 paid order');
    expect(answer.message).toContain('derived');
    expect(answer.message).toContain('COD order');
  });

  it('never presents an unbooked contribution as zero', () => {
    const answer = answerFromFacts(
      'how much profit did I make?',
      facts({ sales: { ...facts().sales, contributionPaise: null, basis: 'UNKNOWN' } })
    );
    expect(answer.message).toContain('not measurable');
    expect(answer.message).not.toContain('₹0');
  });

  it('does not claim revenue when no order was paid', () => {
    const answer = answerFromFacts(
      'revenue?',
      facts({ sales: { ...facts().sales, paidOrders: 0, netRevenuePaise: 0 } })
    );
    expect(answer.message).toContain('No paid order');
    expect(answer.message).toContain('not measurable');
  });

  it('names real stock alerts instead of a generic warning', () => {
    const answer = answerFromFacts(
      'any stock alerts?',
      facts({
        inventory: {
          lowStock: [{ name: 'Cotton Tote Bag', slug: 'cotton-tote-bag', stock: 2, threshold: 5 }],
          outOfStock: [{ name: 'Analog Wall Clock', slug: 'analog-wall-clock', stock: 0, threshold: 5 }],
        },
      })
    );
    expect(answer.message).toContain('Analog Wall Clock');
    expect(answer.message).toContain('Cotton Tote Bag');
    expect(answer.stats[0]?.value).toBe('1');
  });

  it('admits that cart recovery is not automated', () => {
    const answer = answerFromFacts('any abandoned carts?', facts());
    expect(answer.message).toContain('3 saved cart');
    expect(answer.message).toContain('does not send automated cart-recovery');
  });

  it('does not promise a discount past the margin floor', () => {
    const answer = answerFromFacts('run me an instagram flash sale', facts());
    expect(answer.intent).toBe('MARKETING');
    expect(answer.message).toContain('margin floor');
    expect(answer.message).not.toMatch(/guaranteed sales|viral/i);
  });

  it('lists priorities with approval flags', () => {
    const answer = answerFromFacts(
      'what should I do today?',
      facts({
        recommendations: [
          {
            priority: 1,
            issue: 'Stale supplier sync',
            actionLabel: 'Run a supplier dry run',
            href: '/admin/suppliers',
            requiresApproval: true,
          },
        ],
      })
    );
    expect(answer.message).toContain('Stale supplier sync');
    expect(answer.message).toContain('needs your approval');
  });
});
