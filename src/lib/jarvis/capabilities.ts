/**
 * Blueprint capability audit.
 *
 * The blueprint (`AUREVYN_JARVIS_COMMERCE_BLUEPRINT_V2`) lists 1,000 numbered
 * requirements. A catalogue entry is not proof a feature exists, so this file
 * records what the code actually does today, where the code for it lives, and
 * what is still missing. Nothing here may be marked LIVE without a file that
 * implements it — `tests/unit/jarvis-capabilities.test.ts` checks every
 * evidence path exists.
 *
 * Statuses:
 *   LIVE        — implemented and reachable; evidence paths hold the code.
 *   PARTIAL     — works for part of the blueprint, with the named gap open.
 *   BLOCKED     — needs an external account/credential the owner must provide.
 *   NOT_STARTED — no implementation.
 */

export type CapabilityStatus = 'LIVE' | 'PARTIAL' | 'BLOCKED' | 'NOT_STARTED';

export interface Capability {
  id: string;
  /** Blueprint section this satisfies. */
  section: string;
  title: string;
  status: CapabilityStatus;
  /** Implemented reality, phrased so it cannot be read as a promise. */
  reality: string;
  /** What is still missing before this can be called complete. */
  gap: string | null;
  evidence: string[];
  /** True when the owner must act (account, credential, decision). */
  ownerAction: boolean;
}

export const CAPABILITIES: readonly Capability[] = [
  {
    id: 'order-intake',
    section: '§6.1–§6.4',
    title: 'Order intake, validation and idempotency',
    status: 'LIVE',
    reality:
      'Checkout snapshots product, variant, price, address and policy versions, validates stock and price server-side, and refuses duplicate checkout submissions.',
    gap: null,
    evidence: ['src/lib/orders/create.ts', 'src/lib/checkout/calc.ts', 'src/lib/cart/service.ts'],
    ownerAction: false,
  },
  {
    id: 'order-state-machine',
    section: '§6.11–§7',
    title: 'Order state machine with an event trail',
    status: 'LIVE',
    reality:
      'Every status change is validated against an allow-list and written to order_events with actor type, actor id, message and data.',
    gap: null,
    evidence: ['src/lib/orders/state.ts', 'prisma/schema.prisma'],
    ownerAction: false,
  },
  {
    id: 'supplier-provenance',
    section: '§6.10–§6.11',
    title: 'Supplier reference: reported vs confirmed',
    status: 'LIVE',
    reality:
      'A pasted Meesho reference is stored as owner-reported and does not advance the order or notify the customer. Confirmation requires a written evidence note; only then does the order become supplier-accepted.',
    gap: null,
    evidence: [
      'src/lib/orders/placement.ts',
      'src/lib/orders/fulfilment.ts',
      'src/app/api/admin/supplier-orders/[id]/confirm-placement/route.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'owner-handoff',
    section: '§6.5–§6.7',
    title: 'Owner handoff packet for manual Meesho placement',
    status: 'PARTIAL',
    reality:
      'Each Meesho supplier order carries a copy-ready purchase sheet (items, quantities, supplier refs, unit cost, destination) generated from real order data.',
    gap: 'The sheet is stored per supplier order but not yet surfaced as a one-tap copy panel on a dedicated queue screen; the owner opens the supplier order row.',
    evidence: ['src/lib/suppliers/meesho.ts', 'src/app/admin/supplier-orders/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'meesho-boundary',
    section: '§1',
    title: 'No Meesho API, scraping or automated placement',
    status: 'LIVE',
    reality:
      'The Meesho adapter advertises no catalog, stock, status, tracking or cancellation capability. It queues the work and refuses to invent provider state.',
    gap: null,
    evidence: ['src/lib/suppliers/meesho.ts', 'src/lib/suppliers/registry.ts'],
    ownerAction: false,
  },
  {
    id: 'product-evidence',
    section: '§4',
    title: 'Product evidence, freshness and confidence',
    status: 'PARTIAL',
    reality:
      'Candidates carry source, fetch time, freshness, stock evidence, cost verification and a completeness percentage; missing return-rate evidence caps a candidate at WATCH.',
    gap: 'Confidence is computed per candidate but there is no single INSUFFICIENT_DATA verdict or per-component confidence panel on a live product page.',
    evidence: ['src/lib/catalog/candidate-evidence.ts', 'src/lib/sourcing/score.ts'],
    ownerAction: false,
  },
  {
    id: 'unit-economics',
    section: '§4',
    title: 'Estimated vs realised contribution margin',
    status: 'LIVE',
    reality:
      'Every margin line carries a basis (supplier quote, configured, estimate, realised, unknown) so an estimate can never be read as realised profit.',
    gap: null,
    evidence: ['src/lib/catalog/contribution-margin.ts', 'src/lib/orders/finance.ts'],
    ownerAction: false,
  },
  {
    id: 'margin-floor',
    section: '§5',
    title: 'Margin floor and price-change guards',
    status: 'LIVE',
    reality:
      'The pricing engine refuses a selling price below the configured floor; the discount engine caps discounts against the same floor.',
    gap: null,
    evidence: [
      'src/lib/pricing/engine.ts',
      'src/lib/pricing/resolve.ts',
      'src/lib/checkout/coupons.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'listing-gates',
    section: '§5',
    title: 'Draft, publish and approval gates',
    status: 'LIVE',
    reality:
      'Supplier products import as drafts, publish only through the validated product write path, and auto-publish requires the configured margin, score and demand-confidence thresholds.',
    gap: null,
    evidence: ['src/lib/catalog/publish.ts', 'src/lib/catalog/auto-import.ts'],
    ownerAction: false,
  },
  {
    id: 'pause-switches',
    section: '§11',
    title: 'Independent emergency pause switches',
    status: 'LIVE',
    reality:
      'Listings, outbound messages, agents and automations can each be paused from the Jarvis panel; the pause is enforced in publishing, notification queuing, team cycles and supplier syncs.',
    gap: null,
    evidence: ['src/lib/jarvis/pause.ts', 'src/app/admin/jarvis/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'roles',
    section: '§3',
    title: 'Roles and per-action permission checks',
    status: 'PARTIAL',
    reality:
      'Admin-only panel plus per-route requireAdminWrite rate-limited guards; customers can only read their own orders, addresses and messages.',
    gap: 'No separate support-operator role with profit/cost visibility withheld; STAFF is redirected to the account area rather than granted a scoped console.',
    evidence: ['src/lib/auth/guards.ts', 'src/lib/auth/permissions.ts', 'src/lib/orders/access.ts'],
    ownerAction: false,
  },
  {
    id: 'command-centre',
    section: '§8',
    title: 'Private command centre',
    status: 'PARTIAL',
    reality:
      'The admin console covers orders, supplier handoff, sourcing, pricing, returns, refunds, audit, health, the 119-specialist bench and this Jarvis control screen.',
    gap: 'No voice/chat surface (removed deliberately in favour of one team), and no unified agent-run history with per-run tool allowlists.',
    evidence: ['src/app/admin/jarvis/page.tsx', 'src/app/admin/team/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'voice',
    section: '§8, §9',
    title: 'Voice / push-to-talk interface',
    status: 'NOT_STARTED',
    reality:
      'The previous co-founder voice surface was deleted so there is one plan and one team. Nothing replaces it yet.',
    gap: 'A push-to-talk front end backed by a speech-to-text adapter, plus an Android foreground-service companion if wake-word use is wanted.',
    evidence: ['src/lib/team/agents.ts'],
    ownerAction: true,
  },
  {
    id: 'agent-supervisor',
    section: '§9',
    title: 'Agent supervisor with specialists',
    status: 'PARTIAL',
    reality:
      '119 specialists across 10 departments, a deterministic planner producing objectives → tasks → dependencies → owners → waves, and stored briefing cycles.',
    gap: 'Specialists have no executable tool allowlist, timeout or per-run budget; the planner plans, it does not dispatch model calls.',
    evidence: ['src/lib/team/workflow.ts', 'src/lib/team/agents.ts', 'src/lib/team/service.ts'],
    ownerAction: false,
  },
  {
    id: 'model-router',
    section: '§9',
    title: 'Model router and provider usage accounting',
    status: 'BLOCKED',
    reality:
      'The assistant and AI-CEO modules read an OpenAI-compatible key from the environment and degrade to deterministic output when it is absent. No key is configured.',
    gap: 'Owner must supply an LLM key (see docs/AI_PROVIDERS.md). Multi-provider routing and per-model usage accounting are not built.',
    evidence: ['src/lib/ai/provider.ts', 'src/lib/ai-ceo/provider.ts', 'docs/AI_PROVIDERS.md'],
    ownerAction: true,
  },
  {
    id: 'memory',
    section: '§9',
    title: 'Memory and knowledge retrieval',
    status: 'PARTIAL',
    reality:
      'Store knowledge is a curated in-repo document set with guardrails limiting what the assistant may answer.',
    gap: 'No pgvector retrieval over approved documents, and no separation table between business knowledge and customer personal data.',
    evidence: ['src/lib/assistant/knowledge.ts', 'src/lib/assistant/guard.ts'],
    ownerAction: false,
  },
  {
    id: 'durable-jobs',
    section: '§9',
    title: 'Durable background work',
    status: 'LIVE',
    reality:
      'Row-locked job queue with fencing tokens, heartbeats, exponential backoff, stale-lock recovery and idempotency keys. No browser tab needs to be open.',
    gap: null,
    evidence: [
      'src/lib/jobs/queue.ts',
      'src/lib/jobs/runner.ts',
      'src/lib/jobs/handlers.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'serverless-limits',
    section: '§9',
    title: '24/7 execution model',
    status: 'PARTIAL',
    reality:
      'Web workloads run on Vercel; cron endpoints (/api/cron/jobs, /api/cron/team) drive the queue and team cycles with a shared secret.',
    gap: 'No always-on worker or daemon; a scheduler must call the cron endpoints, and long work is bounded by function timeouts.',
    evidence: ['src/app/api/cron/jobs/route.ts', 'src/app/api/cron/team/route.ts'],
    ownerAction: true,
  },
  {
    id: 'notifications',
    section: '§9',
    title: 'Notification pipeline with consent and dedupe',
    status: 'LIVE',
    reality:
      'Templates render at queue time from real data, every send is a durable job with a 10-minute dedupe window, and failures are recorded, never silently dropped.',
    gap: null,
    evidence: ['src/lib/notifications/notify.ts', 'src/lib/notifications/templates.ts'],
    ownerAction: false,
  },
  {
    id: 'monitoring',
    section: '§9',
    title: 'Health, logs and incident visibility',
    status: 'LIVE',
    reality:
      'Public health endpoint, admin health page, structured logs with redaction, error log table, job queue and webhook log views.',
    gap: null,
    evidence: ['src/app/api/health/route.ts', 'src/lib/logger.ts', 'src/app/admin/health/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'audit',
    section: '§11',
    title: 'Audit trail for privileged actions',
    status: 'LIVE',
    reality:
      'Admin mutations write audit rows with actor, action, entity and request context, readable in the admin audit log.',
    gap: null,
    evidence: ['src/lib/audit.ts', 'src/app/admin/logs/audit/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'customer-isolation',
    section: '§11',
    title: 'Customer data isolation',
    status: 'LIVE',
    reality:
      'Order, address and message reads are scoped to the session user; guest access requires the order number plus email match.',
    gap: null,
    evidence: [
      'src/lib/orders/access.ts',
      'src/app/api/orders/[orderNumber]/cancel/route.ts',
      'src/app/api/track/route.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'payments',
    section: '§6',
    title: 'Payments: UPI QR and COD',
    status: 'PARTIAL',
    reality:
      'UPI QR with owner-side verification and COD are implemented; the provider reports NONE in production because no UPI VPA is configured.',
    gap: 'Owner must set the UPI VPA in Admin → Settings → Payments and verify a test payment.',
    evidence: ['src/lib/payments/upi.ts', 'src/lib/payments/config.ts'],
    ownerAction: true,
  },
  {
    id: 'returns',
    section: '§7',
    title: 'Returns, refunds and RTO',
    status: 'LIVE',
    reality:
      'Return requests, RTO receipts, refund accounting and policy windows are modelled with status transitions and customer notifications.',
    gap: null,
    evidence: ['src/lib/orders/returns.ts', 'src/lib/payments/refunds.ts'],
    ownerAction: false,
  },
  {
    id: 'backups',
    section: '§11',
    title: 'Backup and restore rehearsal',
    status: 'NOT_STARTED',
    reality:
      'The database is a managed Neon instance; no restore has been rehearsed from this application.',
    gap: 'Run and record a restore rehearsal against a Neon branch, and document the recovery time.',
    evidence: ['docs/OWNER_RUNBOOK.md'],
    ownerAction: true,
  },
  {
    id: 'requirement-registry',
    section: '§13',
    title: 'Tracked requirement registry',
    status: 'PARTIAL',
    reality:
      'This audit tracks capability areas against code with evidence paths and named gaps; the full 1,000-item list remains a document, not per-item database rows.',
    gap: 'Per-requirement status, owner and acceptance evidence are not stored individually.',
    evidence: ['src/lib/jarvis/capabilities.ts', 'docs/JARVIS_BLUEPRINT_STATUS.md'],
    ownerAction: false,
  },
  {
    id: 'sourcing-candidates',
    section: '§4, §5',
    title: 'Meesho sourcing candidates end to end',
    status: 'LIVE',
    reality:
      'Owner-entered Meesho listings are scored on margin, returns, demand, rating and trend, kept as candidates with evidence, and published only through the gated path.',
    gap: null,
    evidence: ['src/lib/sourcing/service.ts', 'src/lib/sourcing/score.ts', 'src/app/admin/sourcing/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'connector-registry',
    section: 'V3 §1, §3, §4',
    title: 'Tool and connector registry with recorded policy checks',
    status: 'LIVE',
    reality:
      'A code-reviewed registry lists every external connector and agent tool. Meesho is DISABLED, every one of its checks is PENDING, and connectorActivation() refuses activation without a source URL, a verification date and a PASSED outcome.',
    gap: null,
    evidence: [
      'src/lib/jarvis/registry.ts',
      'src/app/admin/jarvis/page.tsx',
      'tests/unit/jarvis-registry.test.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'agent-tool-permissions',
    section: 'V3 §6, §7',
    title: 'Agent tool permissions and approval boundary',
    status: 'PARTIAL',
    reality:
      'Every tool declares a permission level, an approval requirement, reversibility and a per-cycle budget; authorizeToolCall() denies unapproved irreversible work and hard-disabled tools (place supplier order, delete production data).',
    gap: 'The deterministic team planner does not yet dispatch tool calls, so the boundary is enforced at the registry/API level but not exercised by a running agent loop.',
    evidence: ['src/lib/jarvis/registry.ts', 'src/lib/team/workflow.ts'],
    ownerAction: false,
  },
  {
    id: 'knowledge-base',
    section: 'V3 §2',
    title: 'Sourced knowledge base with verification and recheck dates',
    status: 'LIVE',
    reality:
      'Knowledge entries carry a category, source type, source URL/title, publication date, verification date, confidence and recheck date. A VERIFIED entry is refused without an official/primary source and a date, and stale entries are labelled “Needs recheck”.',
    gap: null,
    evidence: [
      'src/lib/jarvis/knowledge.ts',
      'src/lib/jarvis/knowledge-service.ts',
      'src/app/admin/jarvis/knowledge/page.tsx',
      'tests/unit/jarvis-knowledge.test.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'approval-queue',
    section: 'V3 §7',
    title: 'Human approval queue derived from live records',
    status: 'LIVE',
    reality:
      'Supplier placements, unverified references, refunds, returns, unmatched UPI payments, drafts and failed jobs are listed with what the owner must do. The queue never performs the action or promises an outcome.',
    gap: null,
    evidence: ['src/lib/jarvis/approvals.ts', 'src/app/admin/jarvis/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'incident-log',
    section: 'V3 §15',
    title: 'Incident records with severity, evidence and recovery',
    status: 'LIVE',
    reality:
      'Detection scans open de-duplicated incidents (reference, severity, affected service, evidence, occurrences). Resolution requires a written note and is audited; a resolved incident is never silently reopened.',
    gap: null,
    evidence: [
      'src/lib/jarvis/incidents.ts',
      'src/app/api/cron/jarvis/route.ts',
      'prisma/schema.prisma',
      'tests/unit/jarvis-incidents.test.ts',
    ],
    ownerAction: false,
  },
  {
    id: 'daily-report',
    section: 'V3 §17',
    title: 'Daily operations report with verified/estimate/unknown basis',
    status: 'LIVE',
    reality:
      'The daily report reads live records and labels every metric VERIFIED, ESTIMATE or UNKNOWN. Realised profit is UNKNOWN when no order finalised; estimates are never summed into verified money.',
    gap: null,
    evidence: ['src/lib/jarvis/report.ts', 'src/app/admin/jarvis/report/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'release-readiness',
    section: 'V3 §20',
    title: 'Release status from evidence, not from code existing',
    status: 'LIVE',
    reality:
      'PLANNED / IN DEVELOPMENT / TESTING / BLOCKED / VERIFIED / PRODUCTION READY are computed from recorded checks. A failed check (payments, backup rehearsal) blocks the label; PRODUCTION READY also needs explicit owner sign-off.',
    gap: null,
    evidence: ['src/lib/jarvis/readiness.ts', 'src/app/admin/jarvis/page.tsx'],
    ownerAction: false,
  },
  {
    id: 'cost-controls',
    section: 'V3 §16',
    title: 'Provider cost and usage control',
    status: 'PARTIAL',
    reality:
      'Per-tool call budgets and per-route admin rate limits exist, and every AI provider is registered with a pending hard-spend-limit check.',
    gap: 'No per-model token/usage ledger or provider spend cap is recorded, because no LLM key is configured to measure against.',
    evidence: ['src/lib/jarvis/registry.ts', 'src/lib/rate-limit.ts'],
    ownerAction: true,
  },
  {
    id: 'trend-intelligence',
    section: '§4',
    title: 'Demand and trend intelligence',
    status: 'PARTIAL',
    reality:
      'Demand signals come from owner-entered marketplace evidence (units sold, reviews, rating) at a point in time.',
    gap: 'No permitted external trend feed, so trend velocity and persistence are owner-supplied rather than measured.',
    evidence: ['src/lib/sourcing/types.ts', 'src/lib/sourcing/score.ts'],
    ownerAction: false,
  },
] as const;

export const CAPABILITY_STATUS_LABEL: Record<CapabilityStatus, string> = {
  LIVE: 'Live',
  PARTIAL: 'Partial',
  BLOCKED: 'Blocked',
  NOT_STARTED: 'Not started',
};

export function capabilitySummary(list: readonly Capability[] = CAPABILITIES): Record<
  CapabilityStatus,
  number
> {
  const summary: Record<CapabilityStatus, number> = {
    LIVE: 0,
    PARTIAL: 0,
    BLOCKED: 0,
    NOT_STARTED: 0,
  };
  for (const capability of list) summary[capability.status] += 1;
  return summary;
}

export function ownerActions(list: readonly Capability[] = CAPABILITIES): Capability[] {
  return list.filter((c) => c.ownerAction);
}
