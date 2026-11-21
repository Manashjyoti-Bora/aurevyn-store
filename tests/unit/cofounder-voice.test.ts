import { describe, expect, it } from 'vitest';
import { buildVoiceBriefing, type VoiceBriefingInput } from '@/lib/cofounder/voice';

const base: VoiceBriefingInput = {
  storeName: 'Nirvora',
  now: '2026-11-21T14:00:00.000Z',
  ordersAwaitingPlacement: [],
  paymentsAwaitingVerification: 0,
  supportNew: 0,
  lowStock: 0,
  outOfStock: 0,
  failedJobs: 0,
};

const order = {
  id: 'so1',
  orderNumber: 'NV-1001',
  city: 'Guwahati',
  totalPaise: 129_900,
  marginPaise: 41_200,
  itemCount: 1,
  supplierOrderId: 'so1',
  placedOnMeesho: false,
};

describe('co-founder voice', () => {
  it('says the store is clear when nothing is open', () => {
    const briefing = buildVoiceBriefing(base);
    expect(briefing.urgent).toBe(false);
    expect(briefing.script).toMatch(/Everything measured is clear/i);
    expect(briefing.orders).toHaveLength(0);
  });

  it('names the order, city, value and margin', () => {
    const briefing = buildVoiceBriefing({ ...base, ordersAwaitingPlacement: [order] });
    expect(briefing.urgent).toBe(true);
    expect(briefing.script).toContain('NV-1001');
    expect(briefing.script).toContain('Guwahati');
    expect(briefing.script).toContain('412');
    expect(briefing.script).toMatch(/Meesho order ID/i);
  });

  it('stops asking for the ID once it is recorded', () => {
    const briefing = buildVoiceBriefing({
      ...base,
      ordersAwaitingPlacement: [{ ...order, placedOnMeesho: true }],
    });
    expect(briefing.script).toMatch(/already recorded/i);
  });

  it('sums expected margin across several orders', () => {
    const briefing = buildVoiceBriefing({
      ...base,
      ordersAwaitingPlacement: [order, { ...order, id: 'so2', orderNumber: 'NV-1002' }],
    });
    expect(briefing.script).toMatch(/2 paid orders/i);
    expect(briefing.script).toContain('824');
  });

  it('keeps the same fingerprint until a number changes', () => {
    const first = buildVoiceBriefing({ ...base, ordersAwaitingPlacement: [order] });
    const second = buildVoiceBriefing({ ...base, ordersAwaitingPlacement: [order] });
    const changed = buildVoiceBriefing({ ...base, ordersAwaitingPlacement: [] });
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it('lists the operational watches it is allowed to speak about', () => {
    const briefing = buildVoiceBriefing({
      ...base,
      paymentsAwaitingVerification: 2,
      failedJobs: 1,
      supportNew: 3,
      outOfStock: 1,
      lowStock: 4,
    });
    expect(briefing.script).toMatch(/2 UPI payment/i);
    expect(briefing.script).toMatch(/1 failed background job/i);
    expect(briefing.script).toMatch(/3 new customer message/i);
    expect(briefing.script).toMatch(/1 product sold out/i);
    expect(briefing.script).toMatch(/4 product low on stock/i);
  });
});
