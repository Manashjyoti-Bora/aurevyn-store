import { describe, expect, it } from 'vitest';
import {
  buildGuidance,
  detectIntent,
  extractKeywords,
  parseBudgetPaise,
} from '@/lib/assistant/knowledge';
import { isSafeOpenEndedReply, sanitizeModelText } from '@/lib/assistant/guard';
import type { AssistantFacts } from '@/lib/assistant/types';

function facts(overrides: Partial<AssistantFacts> = {}): AssistantFacts {
  const base: AssistantFacts = {
    storeName: 'Aurevyn',
    supportEmail: 'care@aurevyn.in',
    supportPhone: null,
    pricesIncludeTax: true,
    shipping: {
      flatRatePaise: 4900,
      freeAbovePaise: 99900,
      codEnabled: false,
      codFeePaise: 0,
      estimatedDaysMin: 3,
      estimatedDaysMax: 7,
    },
    policies: { returnWindowDays: 7, cancellationWindowHours: 24 },
    payments: { kind: 'NONE', label: 'Not configured', isTest: false },
    demoMode: false,
  };
  return {
    ...base,
    ...overrides,
    shipping: { ...base.shipping, ...(overrides.shipping ?? {}) },
    policies: { ...base.policies, ...(overrides.policies ?? {}) },
    payments: { ...base.payments, ...(overrides.payments ?? {}) },
  };
}

describe('parseBudgetPaise', () => {
  it('reads an upper bound with a rupee symbol and thousands separator', () => {
    expect(parseBudgetPaise('headphones under ₹2,000')).toEqual({
      minPaise: null,
      maxPaise: 200000,
    });
  });

  it('reads a range', () => {
    expect(parseBudgetPaise('between 500 and 900 please')).toEqual({
      minPaise: 50000,
      maxPaise: 90000,
    });
  });

  it('reads a lower bound only', () => {
    expect(parseBudgetPaise('something above 1500')).toEqual({
      minPaise: 150000,
      maxPaise: null,
    });
  });

  it('returns no bounds when no budget is present', () => {
    expect(parseBudgetPaise('show me a cotton shirt')).toEqual({
      minPaise: null,
      maxPaise: null,
    });
  });
});

describe('detectIntent', () => {
  it('routes policy questions before product browsing', () => {
    expect(detectIntent('how much is delivery?')).toBe('SHIPPING');
    expect(detectIntent('can I return this after a week?')).toBe('RETURNS');
    expect(detectIntent('where is my order')).toBe('TRACKING');
    expect(detectIntent('can I change my address')).toBe('ORDER_CHANGE');
    expect(detectIntent('do you accept UPI?')).toBe('PAYMENTS');
  });

  it('recognises greetings and capability questions', () => {
    expect(detectIntent('hello!')).toBe('GREETING');
    expect(detectIntent('what can you do?')).toBe('CAPABILITIES');
  });

  it('treats a product request as catalog search', () => {
    expect(detectIntent('show me running shoes under 2000')).toBe('PRODUCT_SEARCH');
    expect(detectIntent('recommend a gift')).toBe('RECOMMEND');
  });

  it('returns UNKNOWN for an unclassified message', () => {
    expect(detectIntent('asdfgh')).toBe('UNKNOWN');
  });
});

describe('extractKeywords', () => {
  it('drops budget and intent words but keeps the product subject', () => {
    expect(extractKeywords('show me wireless headphones under ₹2,000')).toEqual([
      'wireless',
      'headphones',
    ]);
  });
});

describe('buildGuidance — grounded in store settings', () => {
  it('states only the configured shipping amounts and window', () => {
    const reply = buildGuidance('SHIPPING', facts());
    expect(reply.message).toContain('₹49');
    expect(reply.message).toContain('₹999');
    expect(reply.message).toContain('3–7 business days');
    expect(reply.message).toContain('Cash on Delivery is not offered');
    expect(reply.message).not.toMatch(/1–2 days|free delivery|guaranteed/i);
  });

  it('does not claim COD when it is disabled', () => {
    const reply = buildGuidance('PAYMENTS', facts());
    expect(reply.message).toContain('not offered at checkout');
  });

  it('reflects a zero return window instead of promising returns', () => {
    const reply = buildGuidance(
      'RETURNS',
      facts({ policies: { returnWindowDays: 0, cancellationWindowHours: 0 } })
    );
    expect(reply.message).toContain('does not currently accept returns');
    expect(reply.message).not.toContain('within 7 days');
  });

  it('labels a TEST payment provider honestly', () => {
    const reply = buildGuidance(
      'PAYMENTS',
      facts({ payments: { kind: 'TEST', label: 'TEST provider', isTest: true } })
    );
    expect(reply.message).toContain('TEST provider');
    expect(reply.message).toContain('no real money moves');
  });

  it('uses the real support address when one is configured', () => {
    expect(buildGuidance('CONTACT', facts()).message).toContain('care@aurevyn.in');
    expect(
      buildGuidance('CONTACT', facts({ supportEmail: null })).message
    ).toContain('contact form');
  });
});

describe('model output guard', () => {
  it('rejects any reply containing a number or currency symbol', () => {
    expect(isSafeOpenEndedReply('We deliver in 3 days, guaranteed!')).toBe(false);
    expect(isSafeOpenEndedReply('It costs ₹499 and ships fast, ask me more.')).toBe(false);
  });

  it('accepts a genuine clarification with no invented facts', () => {
    expect(
      isSafeOpenEndedReply(
        'Lovely — tell me a little more about what you are looking for and I will search the live catalog for you.'
      )
    ).toBe(true);
  });

  it('strips control characters before the guard runs', () => {
    expect(sanitizeModelText('  hello\u0000   there,   how can I help you today  ')).toBe(
      'hello there, how can I help you today'
    );
    expect(sanitizeModelText(null)).toBeNull();
  });
});
