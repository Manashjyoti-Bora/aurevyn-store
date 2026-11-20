/**
 * Types for the customer-facing store concierge.
 *
 * The concierge answers from two sources only: the live catalog and the
 * store's own settings (shipping, returns, payments). It never invents a
 * product, price, review or delivery promise. The optional model path may
 * only rephrase a general reply — it is never allowed to state store facts
 * (see model.ts).
 */

export type AssistantIntent =
  | 'GREETING'
  | 'SMALLTALK'
  | 'CAPABILITIES'
  | 'PRODUCT_SEARCH'
  | 'RECOMMEND'
  | 'SHIPPING'
  | 'RETURNS'
  | 'PAYMENTS'
  | 'TRACKING'
  | 'ORDER_CHANGE'
  | 'CONTACT'
  | 'STORE'
  | 'UNKNOWN';

export interface BudgetRange {
  minPaise: number | null;
  maxPaise: number | null;
}

/** A catalog item as shown inside a concierge reply. */
export interface AssistantProduct {
  slug: string;
  name: string;
  pricePaise: number;
  compareAtPricePaise: number | null;
  imageUrl: string | null;
  categoryName: string | null;
  /** False only when the availability model says it cannot be bought. */
  available: boolean;
}

export interface AssistantAction {
  label: string;
  href: string;
}

export interface AssistantReply {
  message: string;
  intent: AssistantIntent;
  products: AssistantProduct[];
  actions: AssistantAction[];
  followUps: string[];
  /**
   * Where the wording came from. `MODEL` means an optional language model
   * rephrased a general reply; every product/policy answer is deterministic.
   */
  source: 'CATALOG' | 'POLICY' | 'GUIDANCE' | 'MODEL';
  /** True only when a configured provider actually answered. */
  modelUsed: boolean;
}

/** The store facts the concierge is allowed to state. */
export interface AssistantFacts {
  storeName: string;
  /** Null while the stored address is still the shipped placeholder. */
  supportEmail: string | null;
  supportPhone: string | null;
  pricesIncludeTax: boolean;
  shipping: {
    flatRatePaise: number;
    freeAbovePaise: number;
    codEnabled: boolean;
    codFeePaise: number;
    estimatedDaysMin: number;
    estimatedDaysMax: number;
  };
  policies: {
    returnWindowDays: number;
    cancellationWindowHours: number;
  };
  payments: {
    kind: 'UPI' | 'TEST' | 'NONE';
    label: string;
    isTest: boolean;
  };
  demoMode: boolean;
}

export interface AssistantGuidance {
  message: string;
  actions: AssistantAction[];
  followUps: string[];
  source: 'POLICY' | 'GUIDANCE';
}
