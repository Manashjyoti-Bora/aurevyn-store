import type { EvidenceBasis, HealthLevel } from '@/lib/ai-ceo/contracts';

/**
 * Contracts for the owner-facing AI cofounder chat.
 *
 * The chat is a READ-ONLY operator: every figure it quotes is mapped from the
 * deterministic AI CEO report or a bounded count taken for the same request.
 * No model writes numbers here.
 */

export type CofounderIntent =
  | 'GREETING'
  | 'CAPABILITIES'
  | 'PRIORITIES'
  | 'SALES'
  | 'ORDERS'
  | 'INVENTORY'
  | 'CARTS'
  | 'CATALOG'
  | 'SUPPLIERS'
  | 'LAUNCH'
  | 'SUPPORT'
  | 'MARKETING'
  | 'RISKS'
  | 'UNKNOWN';

export interface CofounderStat {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'negative';
}

export interface CofounderAction {
  label: string;
  href: string;
}

export interface CofounderAnswer {
  message: string;
  intent: CofounderIntent;
  stats: CofounderStat[];
  actions: CofounderAction[];
  followUps: string[];
}

export interface ProductAlert {
  name: string;
  slug: string;
  stock: number;
  threshold: number;
}

/** Everything the chat is allowed to say, already reduced to safe facts. */
export interface CofounderFacts {
  storeName: string;
  windowDays: number;
  headline: string;
  overallLevel: HealthLevel;
  sales: {
    paidOrders: number;
    netRevenuePaise: number;
    contributionPaise: number | null;
    aovPaise: number | null;
    basis: EvidenceBasis;
    caveatCount: number;
    codCommittedOrders: number;
  };
  orders: {
    byStatus: Record<string, number>;
    pendingPaymentOlderThan24h: number;
  };
  risks: Array<{ title: string; severity: string; impact: string; href?: string }>;
  recommendations: Array<{
    priority: number;
    issue: string;
    actionLabel: string;
    href?: string;
    requiresApproval: boolean;
  }>;
  launchBlockers: Array<{ label: string; ownerAction: string }>;
  catalog: {
    activeProducts: number;
    activeWithoutImage: number;
    activeWithoutSupplier: number;
    staleSupplierRows: number;
    outOfStockSupplierRows: number;
  };
  carts: { active: number; stale: number };
  inventory: { lowStock: ProductAlert[]; outOfStock: ProductAlert[] };
  coupons: { active: number };
  support: { open: number };
  jobs: { failedLast24h: number; pending: number };
  actionsEnabled: boolean;
  dailyActionLimit: number;
  dataGaps: string[];
}
