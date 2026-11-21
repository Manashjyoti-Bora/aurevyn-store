/**
 * Zenvora autonomous team — shared contracts.
 *
 * The team is a set of specialised agents that each own one part of the store
 * and work on their own schedule. Two rules keep it honest:
 *
 *  1. An agent never invents a number. Every finding in a briefing comes from
 *     `TeamSignals`, a snapshot loaded by a single bounded adapter.
 *  2. An agent never acts beyond its mandate. `decides` lists the work it does
 *     without asking; `escalates` lists the decisions that stay with the owner.
 *
 * The briefing functions are pure, so the whole team is unit-testable with
 * fixtures and no database.
 */

export type AgentId =
  'orion' | 'vesper' | 'kaizen' | 'lumen' | 'anchor' | 'sentinel' | 'ledger' | 'atlas';

/** CLEAR = nothing needs doing · WATCH = trending wrong · ACT = do this now. */
export type AgentStatus = 'CLEAR' | 'WATCH' | 'ACT';

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  CLEAR: 'All clear',
  WATCH: 'Watching',
  ACT: 'Action needed',
};

export interface AgentSchedule {
  /** How often the agent re-reads the store, in plain language. */
  cadence: string;
  /** The cron expression that actually runs it. */
  cron: string;
}

export interface AgentDefinition {
  id: AgentId;
  /** Human name — the team is addressed by name, not by "AI #4". */
  name: string;
  /** One line the owner reads in the roster. */
  role: string;
  /** The single question this agent exists to answer. */
  mandate: string;
  schedule: AgentSchedule;
  /** Work this agent performs on its own, without the owner. */
  decides: string[];
  /** Decisions that are never delegated to an agent. */
  escalates: string[];
}

/** Live store evidence. Aggregates only — no customer names, e-mails or phones. */
export interface TeamSignals {
  asOf: string;
  windowDays: number;
  store: {
    name: string;
    demoMode: boolean;
    paymentsKind: 'UPI' | 'TEST' | 'NONE';
    paymentsConfigured: boolean;
    cronConfigured: boolean;
    emailLive: boolean;
    storageDurable: boolean;
    supportEmailConfigured: boolean;
    businessComplete: boolean;
  };
  catalog: {
    active: number;
    draft: number;
    archived: number;
    categoriesActive: number;
    categoriesEmpty: number;
    missingImage: number;
    lowStock: number;
    outOfStock: number;
    stale: number;
    withoutSupplierLink: number;
    belowCost: number;
    thinMargin: number;
  };
  orders: {
    awaitingFulfilment: number;
    overdueDispatch: number;
    inTransit: number;
    deliveredWindow: number;
    cancelledWindow: number;
    placedWindow: number;
    staleUnpaid: number;
    revenueWindowPaise: number;
    refundedWindowPaise: number;
  };
  payments: { awaitingVerification: number; failedWindow: number };
  refunds: { requested: number; processing: number };
  returns: { open: number };
  support: { newMessages: number; oldestNewAt: string | null };
  jobs: { pending: number; failed: number; oldestPendingAt: string | null };
  reviews: { published: number; pending: number; productsWithoutReview: number };
  suppliers: { active: number; inactive: number; unmapped: number; failingSync: number };
  coupons: { expiringSoon: number };
  launch: { blockers: string[]; configGaps: string[] };
}

export interface AgentFinding {
  label: string;
  value: string;
  /** How the number was obtained. Never present a weaker source as stronger. */
  basis: 'VERIFIED' | 'DERIVED';
  note?: string;
}

export interface AgentBriefing {
  agentId: AgentId;
  status: AgentStatus;
  /** One sentence with the most important number in it. */
  headline: string;
  /** Two or three sentences of reasoning the owner can act on. */
  summary: string;
  findings: AgentFinding[];
  /** Ordered, concrete things to do next. Empty when nothing is wrong. */
  priorities: string[];
  /** What the system already does about this area without being asked. */
  handled: string[];
}
