/**
 * Meesho sourcing — shared contracts.
 *
 * Nirvora resells Meesho listings. Meesho publishes no public product API
 * (its Supplier/Order API is partner-gated and only for onboarded suppliers),
 * so this module never pretends to scrape or sync Meesho. Instead it scores
 * candidates the owner actually sees in the Meesho app: price, observed
 * rating, observed sales, observed return rate and trend. Every number in a
 * score comes from a value the owner entered; nothing is invented.
 */

export interface SourcingCandidateInput {
  name: string;
  /** Meesho product page URL, when the owner has it. */
  meeshoUrl?: string | null;
  /** Meesho SKU / product id, when visible. */
  sku?: string | null;
  /** Meesho price the owner pays, in paise (tax inclusive). */
  supplierPricePaise: number;
  /** Expected shipping to the customer, in paise. */
  shippingPaise?: number;
  /** Comparable market / MRP price, in paise. */
  mrpPaise?: number | null;
  rating?: number | null;
  reviewCount?: number | null;
  /** Units sold as displayed on the listing. */
  unitsSold?: number | null;
  /** Return rate as displayed/known, in percent. */
  returnRatePercent?: number | null;
  /** 0–100 trend signal (search demand, virality). Optional. */
  trendScore?: number | null;
}

export type SourcingVerdict = 'PUBLISH' | 'WATCH' | 'SKIP';

export interface SourcingScore {
  landedCostPaise: number;
  suggestedPricePaise: number;
  marginPaise: number;
  marginPercent: number;
  score: number;
  verdict: SourcingVerdict;
  /** Ordered, human-readable reasoning with real numbers. */
  reasons: string[];
  /** Missing evidence and risks. Never silently treated as good news. */
  flags: string[];
}

export interface SourcingScoreOptions {
  /** Margin the suggested price aims for, percent of selling price. */
  targetMarginPercent?: number;
  /** Below this margin the candidate is a SKIP. */
  minMarginPercent?: number;
}

export interface SourcingCandidateRecord extends SourcingScore {
  id: string;
  externalKey: string;
  name: string;
  meeshoUrl: string | null;
  sku: string | null;
  supplierPricePaise: number;
  shippingPaise: number;
  mrpPaise: number | null;
  rating: number | null;
  reviewCount: number | null;
  unitsSold: number | null;
  returnRatePercent: number | null;
  trendScore: number | null;
  status: 'OPEN' | 'DRAFTED' | 'DISMISSED';
  productId: string | null;
  createdAt: string;
}
