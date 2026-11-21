import { describe, expect, it } from 'vitest';
import { psychologicalPrice, rankSourcingCandidates, scoreSourcingCandidate } from '@/lib/sourcing/score';
import { externalKeyFor, parseMeeshoProductUrl, parseMeeshoSheet } from '@/lib/sourcing/meesho';

const strong = {
  name: 'Cotton night suit',
  supplierPricePaise: 34_900,
  mrpPaise: 99_900,
  rating: 4.4,
  reviewCount: 1_840,
  unitsSold: 6_200,
  returnRatePercent: 4,
  meeshoUrl: 'https://www.meesho.com/cotton-night-suit/p/abc123',
};

describe('sourcing score', () => {
  it('prices to the target margin and lands on a ₹…9 price', () => {
    const score = scoreSourcingCandidate(strong);
    expect(score.landedCostPaise).toBe(34_900);
    expect(score.suggestedPricePaise % 1000).toBe(900);
    expect(score.marginPaise).toBe(score.suggestedPricePaise - 34_900);
    expect(score.marginPercent).toBeGreaterThan(40);
    expect(score.verdict).toBe('PUBLISH');
  });

  it('never publishes on an unknown return rate', () => {
    const score = scoreSourcingCandidate({ ...strong, returnRatePercent: null });
    expect(score.verdict).not.toBe('PUBLISH');
    expect(score.flags.join(' ')).toMatch(/return rate unknown/i);
  });

  it('skips a listing below the minimum margin', () => {
    const score = scoreSourcingCandidate(
      { ...strong, supplierPricePaise: 90_000, mrpPaise: 95_000, shippingPaise: 500 },
      { minMarginPercent: 15 }
    );
    expect(score.verdict).toBe('SKIP');
    expect(score.reasons.join(' ')).toMatch(/minimum margin/i);
  });

  it('caps the suggested price at the observed market price', () => {
    const score = scoreSourcingCandidate({ ...strong, mrpPaise: 44_900 });
    expect(score.suggestedPricePaise).toBeLessThanOrEqual(44_900);
    expect(score.flags.join(' ')).toMatch(/market price/i);
  });

  it('treats a high return rate as a warning, not a bargain', () => {
    const score = scoreSourcingCandidate({ ...strong, returnRatePercent: 22 });
    expect(score.verdict).not.toBe('PUBLISH');
    expect(score.flags.join(' ')).toMatch(/high return/i);
  });

  it('refuses to score a listing with no purchase price', () => {
    const score = scoreSourcingCandidate({ ...strong, supplierPricePaise: 0 });
    expect(score.verdict).toBe('SKIP');
    expect(score.score).toBe(0);
  });

  it('includes shipping in the landed cost', () => {
    const score = scoreSourcingCandidate({ ...strong, shippingPaise: 5_000 });
    expect(score.landedCostPaise).toBe(39_900);
  });

  it('ranks higher scores first and cheaper cost on a tie', () => {
    const a = { id: 'a', score: scoreSourcingCandidate(strong) };
    const b = {
      id: 'b',
      score: scoreSourcingCandidate({ ...strong, unitsSold: 12, reviewCount: 4, rating: 3.1 }),
    };
    const ranked = rankSourcingCandidates([b, a]);
    expect(ranked.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('rounds psychological prices upward, never down', () => {
    expect(psychologicalPrice(34_900)).toBe(34_900);
    expect(psychologicalPrice(34_000)).toBe(34_900);
    expect(psychologicalPrice(1)).toBe(900);
  });
});

describe('Meesho sheet parsing', () => {
  it('parses a full row into a candidate', () => {
    const { candidates, skipped } = parseMeeshoSheet(
      'Cotton night suit | ₹349 | 999 | 4.3 | 1,840 | 6,200 | 4 | https://www.meesho.com/night-suit/p/abc123'
    );
    expect(skipped).toHaveLength(0);
    expect(candidates[0]).toMatchObject({
      name: 'Cotton night suit',
      supplierPricePaise: 34_900,
      mrpPaise: 99_900,
      rating: 4.3,
      reviewCount: 1_840,
      unitsSold: 6_200,
      returnRatePercent: 4,
    });
    expect(candidates[0].meeshoUrl).toContain('meesho.com');
  });

  it('accepts short rows and tabs', () => {
    const { candidates } = parseMeeshoSheet('Bottle\t219\t599');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].supplierPricePaise).toBe(21_900);
    expect(candidates[0].mrpPaise).toBe(59_900);
  });

  it('reports unusable lines instead of guessing', () => {
    const { candidates, skipped } = parseMeeshoSheet('no price here\nRack | 189 | 449');
    expect(candidates).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].line).toBe(1);
  });

  it('rejects a non-Meesho link', () => {
    const { skipped } = parseMeeshoSheet('Rack | 189 | https://example.com/rack');
    expect(skipped[0].reason).toMatch(/not a meesho/i);
  });

  it('builds a stable key from the Meesho slug', () => {
    expect(externalKeyFor(strong)).toBe('meesho:abc123');
    expect(parseMeeshoProductUrl('https://www.meesho.com/x/p/ABC123')?.slug).toBe('abc123');
    expect(parseMeeshoProductUrl('https://example.com/x')).toBeNull();
  });
});
