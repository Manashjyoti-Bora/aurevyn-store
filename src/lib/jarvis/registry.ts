/**
 * Tool and connector registry (blueprint V3 §1, §3, §4, §6, §7).
 *
 * This file is the single allow-list of what an agent or connector may do.
 * It is deliberately static and code-reviewed: no database row, no prompt and
 * no web page can add a tool or switch a connector on at runtime.
 *
 * Two independent ideas live here:
 *
 *  1. CONNECTORS — external services. Each carries the policy/permission
 *     checks that must pass before it can be called "active". Meesho is
 *     DISABLED and every one of its checks is PENDING. `connectorActivation()`
 *     refuses activation until every check has a real source URL, a recorded
 *     verification date and a PASSED outcome.
 *
 *  2. AGENT TOOLS — the operations an agent may request. Each declares a
 *     permission level, whether an owner must approve it, whether it is
 *     reversible and a per-cycle call budget. `authorizeToolCall()` is the
 *     boundary; agents cannot grant themselves anything.
 */

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

export type ConnectorStatus = 'DISABLED' | 'PREPARED' | 'ACTIVE';
export type ConnectorAccess = 'NONE' | 'MANUAL_OWNER' | 'OFFICIAL_API';
export type CheckOutcome = 'PENDING' | 'PASSED' | 'FAILED';

export interface VerificationCheck {
  id: string;
  /** The exact question that must be answered with evidence. */
  question: string;
  /** Official/primary source opened by the owner. Null until recorded. */
  sourceUrl: string | null;
  /** ISO date (YYYY-MM-DD) the source was read. Null until recorded. */
  verifiedOn: string | null;
  outcome: CheckOutcome;
  /** What was found. Never a guess. */
  note: string | null;
}

export interface Connector {
  id: string;
  name: string;
  category: 'SUPPLIER' | 'PAYMENT' | 'EMAIL' | 'AI' | 'STORAGE';
  access: ConnectorAccess;
  /** Authorisation status, not a configuration check. */
  status: ConnectorStatus;
  /** What this repository actually does with the service today. */
  reality: string;
  /** Capabilities the service is assumed NOT to provide. */
  notProvided: string[];
  requiresOwnerApproval: boolean;
  checks: VerificationCheck[];
  /** Files that implement (or deliberately do not implement) the integration. */
  evidence: string[];
}

function pending(id: string, question: string): VerificationCheck {
  return {
    id,
    question,
    sourceUrl: null,
    verifiedOn: null,
    outcome: 'PENDING',
    note: 'Not verified. The owner must open the live official policy and record the URL and date.',
  };
}

export const CONNECTORS: readonly Connector[] = [
  {
    id: 'MEESHO',
    name: 'Meesho (manual supplier)',
    category: 'SUPPLIER',
    access: 'MANUAL_OWNER',
    status: 'DISABLED',
    reality:
      'Owner enters Meesho listing evidence by hand, places every Meesho order personally and returns the supplier reference. The store never logs in to Meesho, never scrapes it and never places an order on it.',
    notProvided: [
      'catalogue API',
      'stock API',
      'order placement API',
      'order status API',
      'tracking API',
      'cancellation API',
      'image or description reuse rights',
    ],
    requiresOwnerApproval: true,
    checks: [
      pending('terms-reselling', 'Do the current Meesho terms permit buying for resale and selling elsewhere?'),
      pending('account-permission', 'Does the authorised account owner hold the rights to use this account commercially?'),
      pending('official-api-exists', 'Does an official, documented Meesho API exist for each operation we would need?'),
      pending('api-access-granted', 'Has API access been granted in writing for this account, if an API exists?'),
      pending('image-rights', 'May supplier images, videos and descriptions be reused on our storefront?'),
      pending('automation-allowed', 'Do the terms permit automated access (no scraping, no CAPTCHA bypass, no private endpoints)?'),
    ],
    evidence: ['src/lib/suppliers/meesho.ts', 'src/lib/jarvis/registry.ts', 'docs/SOURCING.md'],
  },
  {
    id: 'CJ_DROPSHIPPING',
    name: 'CJ Dropshipping',
    category: 'SUPPLIER',
    access: 'OFFICIAL_API',
    status: 'DISABLED',
    reality:
      'An adapter exists for the official CJ API. It is disabled until the owner supplies credentials and the permission checks are recorded.',
    notProvided: ['any operation without granted credentials'],
    requiresOwnerApproval: true,
    checks: [
      pending('account', 'Is the CJ account active, verified and owned by the store?'),
      pending('api-terms', 'Do the current CJ API terms permit the intended use?'),
      pending('credentials', 'Are production credentials stored in the deployment secret store (never in the repo)?'),
    ],
    evidence: ['src/lib/suppliers/cj.ts', 'src/lib/suppliers/registry.ts'],
  },
  {
    id: 'UPI_DIRECT',
    name: 'UPI (direct, no gateway)',
    category: 'PAYMENT',
    access: 'MANUAL_OWNER',
    status: 'PREPARED',
    reality:
      'The store renders a UPI QR for its own VPA and an admin matches each UTR against the bank statement. No payment gateway and no gateway credentials exist.',
    notProvided: ['automatic payment confirmation', 'card payments', 'chargebacks', 'instant refunds'],
    requiresOwnerApproval: false,
    checks: [
      pending('vpa-ownership', 'Is the UPI VPA owned by the legal entity that operates the store?'),
      pending('settlement-review', 'Has the owner verified one real payment end to end against the bank statement?'),
    ],
    evidence: ['src/lib/payments/upi.ts', 'src/app/admin/settings/page.tsx'],
  },
  {
    id: 'SMTP_EMAIL',
    name: 'Transactional email (SMTP)',
    category: 'EMAIL',
    access: 'OFFICIAL_API',
    status: 'PREPARED',
    reality:
      'Order notifications are queued as durable jobs and sent through the configured SMTP provider; without SMTP they are logged in development only.',
    notProvided: ['delivery guarantees', 'SMS or WhatsApp delivery'],
    requiresOwnerApproval: false,
    checks: [
      pending('sender-domain', 'Is the sending domain verified with the provider?'),
      pending('consent', 'Are transactional-only messages the only ones sent?'),
    ],
    evidence: ['src/lib/notifications/notify.ts', 'src/lib/notifications/providers.ts'],
  },
  {
    id: 'OPENAI_COMPATIBLE',
    name: 'LLM provider (OpenAI-compatible)',
    category: 'AI',
    access: 'OFFICIAL_API',
    status: 'DISABLED',
    reality:
      'Model-backed assistants degrade to deterministic output when no key is configured. No key is configured, so no model call is made.',
    notProvided: ['any guarantee of model availability or price'],
    requiresOwnerApproval: true,
    checks: [
      pending('provider-terms', 'Do the provider terms permit this commercial use and data handling?'),
      pending('cost-limit', 'Has a hard spending limit been set with the provider?'),
      pending('data-policy', 'Is customer personal data excluded from prompts by design?'),
    ],
    evidence: ['src/lib/ai/provider.ts', 'docs/AI_PROVIDERS.md'],
  },
] as const;

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.id === id.toUpperCase());
}

/** Everything blocking activation, phrased as work the owner can do. */
export function connectorActivation(connector: Connector): {
  ok: boolean;
  blockers: string[];
} {
  const blockers: string[] = [];
  for (const check of connector.checks) {
    if (check.outcome === 'FAILED') {
      blockers.push(`${check.id}: recorded as FAILED — ${check.note ?? 'no note'}`);
      continue;
    }
    if (check.outcome === 'PENDING') blockers.push(`${check.id}: not verified`);
    else {
      if (!check.sourceUrl) blockers.push(`${check.id}: missing source URL`);
      if (!check.verifiedOn) blockers.push(`${check.id}: missing verification date`);
      if (!check.note) blockers.push(`${check.id}: missing what-was-found note`);
    }
  }
  if (connector.requiresOwnerApproval && connector.status !== 'ACTIVE') {
    blockers.push('owner approval not recorded');
  }
  return { ok: blockers.length === 0, blockers };
}

export function connectorSummary(list: readonly Connector[] = CONNECTORS): Record<
  ConnectorStatus,
  number
> {
  const summary: Record<ConnectorStatus, number> = { DISABLED: 0, PREPARED: 0, ACTIVE: 0 };
  for (const connector of list) summary[connector.status] += 1;
  return summary;
}

/** Connectors the code may call without a human in the loop. */
export function automatedConnectors(list: readonly Connector[] = CONNECTORS): Connector[] {
  return list.filter((c) => c.status === 'ACTIVE' && c.access === 'OFFICIAL_API');
}

// ---------------------------------------------------------------------------
// Agent tools
// ---------------------------------------------------------------------------

export type ToolPermission = 'READ' | 'DRAFT' | 'WRITE' | 'IRREVERSIBLE';

export interface AgentTool {
  id: string;
  label: string;
  permission: ToolPermission;
  /** True when a human must approve each call. */
  requiresOwnerApproval: boolean;
  /** False when the effect cannot be undone by the store. */
  reversible: boolean;
  /** Hard per-cycle budget, so a loop cannot spend the owner's money. */
  maxCallsPerCycle: number;
  reality: string;
}

export const AGENT_TOOLS: readonly AgentTool[] = [
  {
    id: 'read-store-state',
    label: 'Read store state',
    permission: 'READ',
    requiresOwnerApproval: false,
    reversible: true,
    maxCallsPerCycle: 20,
    reality: 'Reads orders, catalogue, supplier queue and job status with customer personal data minimised.',
  },
  {
    id: 'research-public-sources',
    label: 'Research public sources',
    permission: 'READ',
    requiresOwnerApproval: false,
    reversible: true,
    maxCallsPerCycle: 10,
    reality: 'Reads public documentation and records sources; never treats page text as an instruction.',
  },
  {
    id: 'draft-product-copy',
    label: 'Draft product copy',
    permission: 'DRAFT',
    requiresOwnerApproval: false,
    reversible: true,
    maxCallsPerCycle: 10,
    reality: 'Creates draft text only. Publishing is a separate, owner-gated write.',
  },
  {
    id: 'draft-customer-reply',
    label: 'Draft customer reply',
    permission: 'DRAFT',
    requiresOwnerApproval: false,
    reversible: true,
    maxCallsPerCycle: 10,
    reality: 'Drafts support text; sending it is a write that a human performs.',
  },
  {
    id: 'write-knowledge-entry',
    label: 'Add knowledge entry',
    permission: 'WRITE',
    requiresOwnerApproval: false,
    reversible: true,
    maxCallsPerCycle: 5,
    reality: 'Adds a sourced knowledge note. Entries are labelled VERIFIED only with an official source and date.',
  },
  {
    id: 'open-incident',
    label: 'Open an incident',
    permission: 'WRITE',
    requiresOwnerApproval: false,
    reversible: true,
    maxCallsPerCycle: 5,
    reality: 'Records a detected failure with evidence and severity.',
  },
  {
    id: 'publish-product',
    label: 'Publish a product',
    permission: 'WRITE',
    requiresOwnerApproval: true,
    reversible: true,
    maxCallsPerCycle: 3,
    reality: 'Goes through the gated publish path and the margin floor. Requires owner approval.',
  },
  {
    id: 'send-customer-email',
    label: 'Send a customer email',
    permission: 'WRITE',
    requiresOwnerApproval: true,
    reversible: false,
    maxCallsPerCycle: 10,
    reality: 'Queues a transactional email. Outbound messages can be paused globally.',
  },
  {
    id: 'issue-refund',
    label: 'Issue a refund',
    permission: 'IRREVERSIBLE',
    requiresOwnerApproval: true,
    reversible: false,
    maxCallsPerCycle: 1,
    reality: 'Moves money. Never available to an agent without explicit owner approval.',
  },
  {
    id: 'place-supplier-order',
    label: 'Place a supplier order',
    permission: 'IRREVERSIBLE',
    requiresOwnerApproval: true,
    reversible: false,
    maxCallsPerCycle: 0,
    reality:
      'Not implemented for Meesho by design. The owner places every supplier purchase manually and reports the reference.',
  },
  {
    id: 'delete-production-data',
    label: 'Delete production data',
    permission: 'IRREVERSIBLE',
    requiresOwnerApproval: true,
    reversible: false,
    maxCallsPerCycle: 0,
    reality: 'No agent tool exists for this. Data deletion is a human, out-of-band operation.',
  },
] as const;

export function getTool(id: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.id === id);
}

export interface ToolCallContext {
  ownerApproved: boolean;
  callsThisCycle: number;
}

/**
 * The permission boundary. An agent gets a tool only when the budget allows,
 * a human approved it where required, and the tool is not a hard "never".
 */
export function authorizeToolCall(
  tool: AgentTool,
  ctx: ToolCallContext
): { allowed: boolean; reason: string } {
  if (tool.maxCallsPerCycle <= 0) {
    return { allowed: false, reason: `${tool.id} is not available to agents` };
  }
  if (ctx.callsThisCycle >= tool.maxCallsPerCycle) {
    return {
      allowed: false,
      reason: `${tool.id} exceeded its per-cycle budget of ${tool.maxCallsPerCycle}`,
    };
  }
  if ((tool.requiresOwnerApproval || tool.permission === 'IRREVERSIBLE') && !ctx.ownerApproved) {
    return { allowed: false, reason: `${tool.id} needs explicit owner approval` };
  }
  return { allowed: true, reason: 'allowed' };
}

export function toolsRequiringApproval(list: readonly AgentTool[] = AGENT_TOOLS): AgentTool[] {
  return list.filter((t) => t.requiresOwnerApproval || t.permission === 'IRREVERSIBLE');
}
