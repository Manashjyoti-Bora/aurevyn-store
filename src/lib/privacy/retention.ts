/**
 * Data-retention policy (blueprint V4 §5 "Privacy", V5 §12.5 "Logging and
 * privacy" and §13 "Database and data integrity").
 *
 * The rule these blueprints set is: *retain only what is necessary, and define
 * the period for each record class*. This module is the single place where
 * those periods live. It is pure — no database, no clock — so the policy can be
 * read and tested without a connection.
 *
 * What is pruned automatically:
 *   diagnostics (error/api logs), processed webhook payloads, resolved support
 *   messages, team cycle briefings and old audit rows.
 *
 * What is never pruned here:
 *   orders, order items/events, payments, refunds, returns, shipments,
 *   tracking events and supplier orders. Those are financial and
 *   consumer-protection records; erasing them on a timer would destroy the
 *   business's own evidence and is not a retention win.
 *
 * Customer erasure (DPDP Act 2023) is a separate, explicitly requested flow in
 * `src/lib/account/deletion.ts`; it anonymises the account and keeps the order
 * ledger for the same reason.
 */

export const DAY_MS = 86_400_000;

export type RetentionDataset =
  'error_logs' | 'api_logs' | 'webhook_events' | 'contact_messages' | 'team_cycles' | 'audit_logs';

export type RetentionBasis =
  'diagnostic' | 'security-audit' | 'customer-support' | 'reconciliation';

export interface RetentionPolicy {
  dataset: RetentionDataset;
  label: string;
  /** Rows older than this many days are deleted by the sweep. */
  retainDays: number;
  basis: RetentionBasis;
  /** True when the row can contain a customer identifier or message body. */
  containsPersonalData: boolean;
  why: string;
}

export const RETENTION_POLICIES: readonly RetentionPolicy[] = Object.freeze([
  {
    dataset: 'error_logs',
    label: 'Application error log',
    retainDays: 30,
    basis: 'diagnostic',
    containsPersonalData: true,
    why: 'Enough history to diagnose a regression; messages and route context can echo customer input.',
  },
  {
    dataset: 'api_logs',
    label: 'Outbound/inbound API log',
    retainDays: 30,
    basis: 'diagnostic',
    containsPersonalData: true,
    why: 'Sanitised request/response bodies are kept for debugging only; a month covers a release cycle.',
  },
  {
    dataset: 'webhook_events',
    label: 'Payment/supplier webhook events',
    retainDays: 180,
    basis: 'reconciliation',
    containsPersonalData: true,
    why: 'Provider retries finish within days; six months still covers a late dispute or refund trace.',
  },
  {
    dataset: 'contact_messages',
    label: 'Resolved support messages',
    retainDays: 180,
    basis: 'customer-support',
    containsPersonalData: true,
    why: 'Unresolved messages are never pruned; a resolved thread is kept six months for context.',
  },
  {
    dataset: 'team_cycles',
    label: 'Autonomous team cycles and briefings',
    retainDays: 90,
    basis: 'diagnostic',
    containsPersonalData: false,
    why: 'Briefings hold counts, not identities; three months is enough to compare cycles.',
  },
  {
    dataset: 'audit_logs',
    label: 'Security/administrative audit trail',
    retainDays: 730,
    basis: 'security-audit',
    containsPersonalData: true,
    why: 'Two years so an incident or a disputed admin action can still be reconstructed.',
  },
] as const);

export interface NeverPrunedRecord {
  entity: string;
  why: string;
}

/** Record classes the sweep must not touch, and the reason. */
export const NEVER_PRUNED: readonly NeverPrunedRecord[] = Object.freeze([
  {
    entity: 'orders / order_items / order_events',
    why: 'Financial and consumer-protection record; the account is anonymised instead of deleting the sale.',
  },
  {
    entity: 'payments / refunds / returns',
    why: 'Money movement must stay reconcilable against the bank and the customer.',
  },
  {
    entity: 'shipments / tracking_events',
    why: 'Delivery evidence for disputes and warranty claims.',
  },
  {
    entity: 'supplier_orders',
    why: 'Owner attestation and supplier reference provenance for each fulfilled order.',
  },
  {
    entity: 'contact_messages with status NEW',
    why: 'An unanswered customer is never deleted by a timer.',
  },
] as const);

export interface RetentionStep {
  dataset: RetentionDataset;
  label: string;
  retainDays: number;
  deleteBefore: Date;
  containsPersonalData: boolean;
}

export function retentionCutoff(policy: Pick<RetentionPolicy, 'retainDays'>, now: Date): Date {
  return new Date(now.getTime() - policy.retainDays * DAY_MS);
}

/** Ordered plan of what a sweep at `now` would delete, oldest rule first. */
export function buildRetentionPlan(now: Date): RetentionStep[] {
  return RETENTION_POLICIES.map((policy) => ({
    dataset: policy.dataset,
    label: policy.label,
    retainDays: policy.retainDays,
    deleteBefore: retentionCutoff(policy, now),
    containsPersonalData: policy.containsPersonalData,
  }));
}

/** Datasets whose rows can carry a customer identifier — used by the sweep log. */
export function personalDataDatasets(): RetentionDataset[] {
  return RETENTION_POLICIES.filter((p) => p.containsPersonalData).map((p) => p.dataset);
}
