import type {
  SourcingCandidateInput,
  SourcingScore,
  SourcingScoreOptions,
  SourcingVerdict,
} from './types';

/**
 * Deterministic sourcing score.
 *
 * One question: if this Meesho listing were live in the store tomorrow, would
 * it make money and stay out of trouble? Five measured inputs answer it:
 *
 *   margin   40  — what is left after the real landed cost
 *   returns  20  — the single biggest killer of resale profit
 *   demand   20  — units sold / review volume
 *   rating   10  — buyer satisfaction signal
 *   trend    10  — is it rising or dying
 *
 * Unknown evidence is never scored as good. A missing return rate caps the
 * candidate at WATCH, because "nobody told me the return rate" is not the same
 * as "returns are low".
 */

export const DEFAULT_TARGET_MARGIN_PERCENT = 45;
export const DEFAULT_MIN_MARGIN_PERCENT = 15;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Round up to the next price ending in 9 (₹349, ₹599) — never below cost+. */
export function psychologicalPrice(paise: number): number {
  if (!Number.isFinite(paise) || paise <= 0) return 0;
  const rupees = Math.ceil(paise / 100);
  const nextNine = Math.ceil((rupees + 1) / 10) * 10 - 1;
  return nextNine * 100;
}

function marginPoints(marginPercent: number): number {
  if (marginPercent <= 10) return 0;
  return clamp(((marginPercent - 10) / 50) * 40, 0, 40);
}

function returnPoints(rate: number | null): number {
  if (rate === null || !Number.isFinite(rate)) return 10;
  if (rate <= 5) return 20;
  if (rate >= 25) return 0;
  return clamp(((25 - rate) / 20) * 20, 0, 20);
}

function demandPoints(unitsSold: number | null, reviewCount: number | null): number {
  const demand = unitsSold ?? reviewCount;
  if (demand === null || !Number.isFinite(demand) || demand <= 0) return 8;
  const scaled = Math.log10(1 + demand) / Math.log10(1 + 500);
  return clamp(scaled * 20, 0, 20);
}

function ratingPoints(rating: number | null): number {
  if (rating === null || !Number.isFinite(rating)) return 5;
  if (rating >= 4.5) return 10;
  if (rating >= 4) return 8;
  if (rating >= 3.5) return 6;
  if (rating >= 3) return 3;
  return 0;
}

function trendPoints(trend: number | null): number {
  if (trend === null || !Number.isFinite(trend)) return 5;
  return clamp(trend, 0, 100) / 10;
}

const inr = (paise: number) => `₹${(paise / 100).toFixed(0)}`;

export function scoreSourcingCandidate(
  input: SourcingCandidateInput,
  options: SourcingScoreOptions = {}
): SourcingScore {
  const targetMargin = options.targetMarginPercent ?? DEFAULT_TARGET_MARGIN_PERCENT;
  const minMargin = options.minMarginPercent ?? DEFAULT_MIN_MARGIN_PERCENT;

  const landedCostPaise = Math.max(
    0,
    Math.round(input.supplierPricePaise) + Math.round(input.shippingPaise ?? 0)
  );

  const flags: string[] = [];
  const reasons: string[] = [];

  if (landedCostPaise <= 0) {
    return {
      landedCostPaise: 0,
      suggestedPricePaise: 0,
      marginPaise: 0,
      marginPercent: 0,
      score: 0,
      verdict: 'SKIP',
      reasons: ['No purchase price was provided, so margin cannot be measured.'],
      flags: ['Missing purchase price'],
    };
  }

  // Target price from the margin the owner wants, then a clean ₹…9 price.
  const rawTarget = landedCostPaise / (1 - clamp(targetMargin, 5, 80) / 100);
  let suggestedPricePaise = psychologicalPrice(rawTarget);

  if (input.mrpPaise && input.mrpPaise > 0) {
    // Never suggest a price above the observed market price: an overpriced
    // listing does not sell, and a fake "discount" is worse.
    if (suggestedPricePaise > input.mrpPaise) {
      suggestedPricePaise = Math.floor(input.mrpPaise / 100) * 100 - 100;
      flags.push(`Market price (${inr(input.mrpPaise)}) caps the price — margin is thinner than target`);
    }
  }
  if (suggestedPricePaise <= landedCostPaise) {
    suggestedPricePaise = landedCostPaise + 100;
  }

  const marginPaise = suggestedPricePaise - landedCostPaise;
  const marginPercent = (marginPaise / suggestedPricePaise) * 100;

  const score = Math.round(
    marginPoints(marginPercent) +
      returnPoints(input.returnRatePercent ?? null) +
      demandPoints(input.unitsSold ?? null, input.reviewCount ?? null) +
      ratingPoints(input.rating ?? null) +
      trendPoints(input.trendScore ?? null)
  );

  if (input.returnRatePercent === null || input.returnRatePercent === undefined) {
    flags.push('Return rate unknown — cannot be called a low-return product yet');
  } else if (input.returnRatePercent >= 15) {
    flags.push(`High return rate (${input.returnRatePercent}%) — returns eat this margin`);
  }
  if ((input.unitsSold ?? 0) === 0 && (input.reviewCount ?? 0) === 0) {
    flags.push('No sales or review evidence yet');
  }
  if ((input.rating ?? 5) < 3.5 && input.rating !== null) {
    flags.push(`Low rating (${input.rating}) — buyers are dissatisfied`);
  }
  if (!input.meeshoUrl) flags.push('No Meesho link saved — reordering needs a manual search');

  reasons.push(
    `Buy ${inr(landedCostPaise)} → sell ${inr(suggestedPricePaise)} = ${inr(marginPaise)} margin (${marginPercent.toFixed(0)}%)`
  );
  if (input.unitsSold) reasons.push(`${input.unitsSold} units sold as listed`);
  if (input.reviewCount) reasons.push(`${input.reviewCount} reviews at ${input.rating ?? '—'}★`);
  if (input.returnRatePercent !== null && input.returnRatePercent !== undefined) {
    reasons.push(`Return rate ${input.returnRatePercent}%`);
  }

  let verdict: SourcingVerdict;
  if (marginPercent < minMargin) {
    verdict = 'SKIP';
    reasons.push(`Below the ${minMargin}% minimum margin`);
  } else if (score >= 65 && input.returnRatePercent !== null && input.returnRatePercent !== undefined) {
    verdict = 'PUBLISH';
  } else if (score < 35) {
    verdict = 'SKIP';
  } else {
    verdict = 'WATCH';
  }

  // A product cannot be recommended on unverified returns, whatever the score.
  if (verdict === 'PUBLISH' && (input.returnRatePercent ?? 100) > 12) verdict = 'WATCH';

  return {
    landedCostPaise,
    suggestedPricePaise,
    marginPaise,
    marginPercent: Math.round(marginPercent * 10) / 10,
    score: clamp(score, 0, 100),
    verdict,
    reasons,
    flags,
  };
}

/** Rank best first: score, then margin, then cheaper landed cost. */
export function rankSourcingCandidates<T extends { score: SourcingScore }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      b.score.score - a.score.score ||
      b.score.marginPercent - a.score.marginPercent ||
      a.score.landedCostPaise - b.score.landedCostPaise
  );
}
