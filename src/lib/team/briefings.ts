import { formatINR } from '@/lib/money';
import type { AgentBriefing, AgentFinding, AgentStatus, TeamSignals } from './types';

/**
 * Pure briefing builders. Same signals in, same briefing out — no clock, no
 * randomness, no model. Each agent answers its own mandate from the evidence
 * and ranks the next actions. Numbers are only ever printed from signals.
 */

function hoursSince(iso: string | null, asOf: string): number | null {
  if (!iso) return null;
  const ms = new Date(asOf).getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / 3_600_000));
}

function ageLabel(iso: string | null, asOf: string): string {
  const hours = hoursSince(iso, asOf);
  if (hours === null) return 'unknown age';
  if (hours < 1) return 'under an hour';
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

const f = (
  label: string,
  value: string,
  basis: AgentFinding['basis'] = 'VERIFIED',
  note?: string
): AgentFinding => ({ label, value, basis, ...(note ? { note } : {}) });

// ---------------------------------------------------------------------------
// Orion — Chief of Staff
// ---------------------------------------------------------------------------
export function orionBriefing(s: TeamSignals): AgentBriefing {
  const blockers = s.launch.blockers;
  const urgent =
    s.orders.overdueDispatch +
    s.payments.awaitingVerification +
    s.support.newMessages +
    s.jobs.failed;

  const status: AgentStatus =
    blockers.length > 0
      ? 'ACT'
      : urgent > 0
        ? 'WATCH'
        : s.launch.configGaps.length > 0
          ? 'WATCH'
          : 'CLEAR';

  const priorities: string[] = [];
  for (const blocker of blockers.slice(0, 4)) priorities.push(blocker);
  if (s.orders.overdueDispatch > 0)
    priorities.push(
      `Dispatch ${s.orders.overdueDispatch} paid order${s.orders.overdueDispatch === 1 ? '' : 's'} older than 24 h`
    );
  if (s.payments.awaitingVerification > 0)
    priorities.push(
      `Verify ${s.payments.awaitingVerification} UPI payment${s.payments.awaitingVerification === 1 ? '' : 's'} against the bank statement`
    );
  if (s.support.newMessages > 0)
    priorities.push(
      `Answer ${s.support.newMessages} new customer message${s.support.newMessages === 1 ? '' : 's'}`
    );
  if (s.jobs.failed > 0)
    priorities.push(
      `Clear ${s.jobs.failed} failed background job${s.jobs.failed === 1 ? '' : 's'}`
    );
  for (const gap of s.launch.configGaps.slice(0, 2)) priorities.push(gap);

  const headline =
    blockers.length > 0
      ? `${blockers.length} launch blocker${blockers.length === 1 ? '' : 's'} standing between the store and real money.`
      : urgent > 0
        ? `${urgent} open item${urgent === 1 ? '' : 's'} need a human decision this cycle.`
        : s.launch.configGaps.length > 0
          ? `The store is sellable; ${s.launch.configGaps.length} configuration gap${s.launch.configGaps.length === 1 ? '' : 's'} remain.`
          : 'Nothing is blocking the store. The team is holding the line.';

  return {
    agentId: 'orion',
    status,
    headline,
    summary:
      `${s.catalog.active} product${s.catalog.active === 1 ? '' : 's'} live, ` +
      `${s.orders.placedWindow} order${s.orders.placedWindow === 1 ? '' : 's'} placed in the last ${s.windowDays} days, ` +
      `${formatINR(s.orders.revenueWindowPaise)} collected. ` +
      (blockers.length > 0
        ? 'The blockers below are ordered by what actually costs money, not by what is easiest.'
        : 'No launch blocker is present; the remaining items are ordinary operations.'),
    findings: [
      f('Revenue', formatINR(s.orders.revenueWindowPaise), 'DERIVED', 'Paid orders in the window'),
      f('Refunded', formatINR(s.orders.refundedWindowPaise), 'DERIVED'),
      f('Open blockers', String(blockers.length)),
      f('Config gaps', String(s.launch.configGaps.length)),
      f('Overdue dispatch', String(s.orders.overdueDispatch)),
    ],
    priorities: priorities.slice(0, 8),
    handled: [
      'Launch readiness is re-evaluated every cycle',
      'Problems are ranked by money at risk, not by category',
      'Owner-only items are labelled instead of silently skipped',
    ],
  };
}

// ---------------------------------------------------------------------------
// Vesper — Catalogue & Merchandising
// ---------------------------------------------------------------------------
export function vesperBriefing(s: TeamSignals): AgentBriefing {
  const problems =
    s.catalog.draft +
    s.catalog.missingImage +
    s.catalog.categoriesEmpty +
    s.catalog.withoutSupplierLink;
  const status: AgentStatus = s.catalog.active === 0 ? 'ACT' : problems > 0 ? 'WATCH' : 'CLEAR';

  const priorities: string[] = [];
  if (s.catalog.active === 0)
    priorities.push('Publish the first product so the storefront has something to sell');
  if (s.catalog.draft > 0)
    priorities.push(
      `Finish and publish ${s.catalog.draft} draft product${s.catalog.draft === 1 ? '' : 's'}`
    );
  if (s.catalog.missingImage > 0)
    priorities.push(
      `Add photography to ${s.catalog.missingImage} live product${s.catalog.missingImage === 1 ? '' : 's'}`
    );
  if (s.catalog.categoriesEmpty > 0)
    priorities.push(
      `Fill or hide ${s.catalog.categoriesEmpty} empty categor${s.catalog.categoriesEmpty === 1 ? 'y' : 'ies'}`
    );
  if (s.catalog.withoutSupplierLink > 0)
    priorities.push(
      `Map ${s.catalog.withoutSupplierLink} live product${s.catalog.withoutSupplierLink === 1 ? '' : 's'} to a supplier SKU`
    );
  if (s.catalog.stale > 0)
    priorities.push(
      `Re-check ${s.catalog.stale} listing${s.catalog.stale === 1 ? '' : 's'} untouched for 45+ days`
    );

  return {
    agentId: 'vesper',
    status,
    headline:
      s.catalog.active === 0
        ? 'The catalogue is empty — the store cannot earn until one product is live.'
        : `${s.catalog.active} live product${s.catalog.active === 1 ? '' : 's'} across ${s.catalog.categoriesActive} filled categor${s.catalog.categoriesActive === 1 ? 'y' : 'ies'}.`,
    summary:
      `${s.catalog.draft} draft${s.catalog.draft === 1 ? '' : 's'}, ${s.catalog.missingImage} live without photography, ` +
      `${s.catalog.archived} archived. A listing is only worth promoting once it has an image, a supplier and a price above cost.`,
    findings: [
      f('Live', String(s.catalog.active)),
      f('Drafts', String(s.catalog.draft)),
      f('Missing images', String(s.catalog.missingImage)),
      f('Empty categories', String(s.catalog.categoriesEmpty)),
      f('No supplier link', String(s.catalog.withoutSupplierLink)),
      f('Stale listings', String(s.catalog.stale)),
    ],
    priorities: priorities.slice(0, 6),
    handled: [
      'Catalogue coverage is recalculated from published products only',
      'Drafts are never counted as sellable',
      'Supplier mapping gaps are surfaced before an order fails',
    ],
  };
}

// ---------------------------------------------------------------------------
// Kaizen — Pricing & Margin
// ---------------------------------------------------------------------------
export function kaizenBriefing(s: TeamSignals): AgentBriefing {
  const status: AgentStatus =
    s.catalog.belowCost > 0
      ? 'ACT'
      : s.catalog.thinMargin > 0 || s.coupons.expiringSoon > 0
        ? 'WATCH'
        : 'CLEAR';

  const priorities: string[] = [];
  if (s.catalog.belowCost > 0)
    priorities.push(
      `Reprice or pause ${s.catalog.belowCost} live product${s.catalog.belowCost === 1 ? '' : 's'} selling below landed cost`
    );
  if (s.catalog.thinMargin > 0)
    priorities.push(
      `Lift ${s.catalog.thinMargin} product${s.catalog.thinMargin === 1 ? '' : 's'} above the minimum margin floor`
    );
  if (s.coupons.expiringSoon > 0)
    priorities.push(
      `Review ${s.coupons.expiringSoon} coupon${s.coupons.expiringSoon === 1 ? '' : 's'} expiring within 7 days`
    );

  return {
    agentId: 'kaizen',
    status,
    headline:
      s.catalog.belowCost > 0
        ? `${s.catalog.belowCost} live product${s.catalog.belowCost === 1 ? '' : 's'} would lose money on every sale.`
        : s.catalog.active === 0
          ? 'No live prices to protect yet.'
          : 'No product is priced below landed cost.',
    summary:
      `Checked ${s.catalog.active} live product${s.catalog.active === 1 ? '' : 's'} against recorded supplier, shipping and other costs. ` +
      `${s.catalog.thinMargin} sit inside the margin floor, ${s.catalog.belowCost} below cost. ` +
      'Products with no recorded cost are excluded, because an unknown cost is not a healthy one.',
    findings: [
      f('Below cost', String(s.catalog.belowCost)),
      f('Inside margin floor', String(s.catalog.thinMargin)),
      f('Coupons expiring', String(s.coupons.expiringSoon)),
      f('Margin floor', 'configured', 'VERIFIED', 'Admin → Settings → Pricing'),
    ],
    priorities: priorities.slice(0, 4),
    handled: [
      'Margin protection gates every coupon and discount at order time',
      'Price recomputation runs on product, supplier and rule changes',
      'Landed cost includes supplier shipping and other costs',
    ],
  };
}

// ---------------------------------------------------------------------------
// Lumen — Growth & Discovery
// ---------------------------------------------------------------------------
export function lumenBriefing(s: TeamSignals): AgentBriefing {
  const reviewFloor = Math.min(3, s.catalog.active);
  const status: AgentStatus =
    s.catalog.active === 0 ||
    (s.catalog.active > 0 && s.reviews.published === 0 && s.orders.deliveredWindow > 0)
      ? 'WATCH'
      : s.reviews.productsWithoutReview > 0 && s.orders.deliveredWindow > 0
        ? 'WATCH'
        : 'CLEAR';

  const priorities: string[] = [];
  if (s.catalog.active === 0)
    priorities.push('Publish products before spending anything on traffic');
  if (s.reviews.published === 0 && s.orders.deliveredWindow > 0)
    priorities.push(
      'Ask the first delivered customers for a verified review — the review section stays empty until then'
    );
  if (s.reviews.pending > 0)
    priorities.push(
      `Moderate ${s.reviews.pending} review${s.reviews.pending === 1 ? '' : 's'} awaiting publication`
    );
  if (s.catalog.missingImage > 0)
    priorities.push('Fix image-less listings — they cannot rank or convert');
  if (s.catalog.active > 0 && s.catalog.active < reviewFloor)
    priorities.push(
      'Grow the catalogue past a handful of products so search and ads have somewhere to land'
    );

  return {
    agentId: 'lumen',
    status,
    headline:
      s.catalog.active === 0
        ? 'Nothing to discover yet — the catalogue is empty.'
        : `${s.reviews.published} verified review${s.reviews.published === 1 ? '' : 's'} across ${s.catalog.active} live product${s.catalog.active === 1 ? '' : 's'}.`,
    summary:
      `${s.reviews.productsWithoutReview} product${s.reviews.productsWithoutReview === 1 ? '' : 's'} still wait for a first review. ` +
      'Ratings and reviews are earned from delivered orders only; the store shows an honest empty state instead of seeded praise. ' +
      'The Google Merchant feed and sitemap are generated from the same live catalogue.',
    findings: [
      f('Published reviews', String(s.reviews.published)),
      f('Awaiting moderation', String(s.reviews.pending)),
      f('Products without reviews', String(s.reviews.productsWithoutReview)),
      f('Delivered in window', String(s.orders.deliveredWindow)),
      f('Live products', String(s.catalog.active)),
    ],
    priorities: priorities.slice(0, 5),
    handled: [
      'Merchant feed and sitemap regenerate from live products',
      'Only verified purchases can leave a review',
      'Structured data appears only when real ratings exist',
    ],
  };
}

// ---------------------------------------------------------------------------
// Anchor — Customer Care
// ---------------------------------------------------------------------------
export function anchorBriefing(s: TeamSignals): AgentBriefing {
  const waiting =
    s.support.newMessages + s.returns.open + s.refunds.requested + s.refunds.processing;
  const oldest = ageLabel(s.support.oldestNewAt, s.asOf);
  const status: AgentStatus =
    (hoursSince(s.support.oldestNewAt, s.asOf) ?? 0) >= 24 || s.orders.overdueDispatch > 0
      ? 'ACT'
      : waiting > 0
        ? 'WATCH'
        : 'CLEAR';

  const priorities: string[] = [];
  if (s.support.newMessages > 0)
    priorities.push(
      `Reply to ${s.support.newMessages} new message${s.support.newMessages === 1 ? '' : 's'} (oldest ${oldest})`
    );
  if (s.returns.open > 0)
    priorities.push(
      `Decide ${s.returns.open} open return request${s.returns.open === 1 ? '' : 's'}`
    );
  if (s.refunds.requested > 0)
    priorities.push(
      `Process ${s.refunds.requested} requested refund${s.refunds.requested === 1 ? '' : 's'}`
    );
  if (s.orders.overdueDispatch > 0)
    priorities.push(
      `Contact or dispatch ${s.orders.overdueDispatch} order${s.orders.overdueDispatch === 1 ? '' : 's'} past 24 h`
    );

  return {
    agentId: 'anchor',
    status,
    headline:
      waiting === 0
        ? 'No customer is waiting on us.'
        : `${waiting} customer item${waiting === 1 ? '' : 's'} open, oldest message ${oldest}.`,
    summary:
      `${s.orders.inTransit} order${s.orders.inTransit === 1 ? '' : 's'} in transit, ` +
      `${s.orders.deliveredWindow} delivered in ${s.windowDays} days, ${s.orders.cancelledWindow} cancelled. ` +
      'Support and returns are counted from real records; nothing is auto-replied on the owner’s behalf.',
    findings: [
      f('New messages', String(s.support.newMessages)),
      f('Oldest message', oldest),
      f('Open returns', String(s.returns.open)),
      f('Refunds requested', String(s.refunds.requested)),
      f('In transit', String(s.orders.inTransit)),
      f('Overdue dispatch', String(s.orders.overdueDispatch)),
    ],
    priorities: priorities.slice(0, 5),
    handled: [
      'Order status and tracking are customer-readable without an agent',
      'Return and refund requests are routed to the queue, not lost',
      'Delayed orders are detected from paid timestamps',
    ],
  };
}

// ---------------------------------------------------------------------------
// Sentinel — Reliability
// ---------------------------------------------------------------------------
export function sentinelBriefing(s: TeamSignals): AgentBriefing {
  const broken = s.jobs.failed + (s.store.cronConfigured ? 0 : 1);
  const status: AgentStatus =
    s.jobs.failed > 0 || !s.store.paymentsConfigured ? 'ACT' : broken > 0 ? 'WATCH' : 'CLEAR';

  const priorities: string[] = [];
  if (s.jobs.failed > 0)
    priorities.push(
      `Inspect ${s.jobs.failed} failed job${s.jobs.failed === 1 ? '' : 's'} before retrying them`
    );
  if (!s.store.paymentsConfigured)
    priorities.push('Configure an online payment method so checkout is not COD-only');
  if (!s.store.cronConfigured)
    priorities.push('Set CRON_SECRET so background work can run on a schedule');
  if (!s.store.emailLive)
    priorities.push('Switch EMAIL_PROVIDER to smtp so customers receive order mail');
  if (!s.store.storageDurable)
    priorities.push('Move media storage off local disk — uploads vanish on serverless');

  return {
    agentId: 'sentinel',
    status,
    headline:
      s.jobs.failed > 0
        ? `${s.jobs.failed} background job${s.jobs.failed === 1 ? '' : 's'} failed.`
        : !s.store.paymentsConfigured
          ? 'Payments are not configured; the store cannot take online money yet.'
          : 'No failed jobs, no missing core configuration.',
    summary:
      `Queue: ${s.jobs.pending} pending, ${s.jobs.failed} failed` +
      (s.jobs.oldestPendingAt
        ? `, oldest due ${ageLabel(s.jobs.oldestPendingAt, s.asOf)} ago`
        : '') +
      `. Payments ${s.store.paymentsKind}, e-mail ${s.store.emailLive ? 'live' : 'console-only'}, ` +
      `media ${s.store.storageDurable ? 'durable' : 'ephemeral'}.`,
    findings: [
      f('Failed jobs', String(s.jobs.failed)),
      f('Pending jobs', String(s.jobs.pending)),
      f('Payment provider', s.store.paymentsKind),
      f('E-mail delivery', s.store.emailLive ? 'SMTP' : 'Console'),
      f('Media storage', s.store.storageDurable ? 'Durable' : 'Local / ephemeral'),
      f('Launch blockers', String(s.launch.blockers.length)),
    ],
    priorities: priorities.slice(0, 6),
    handled: [
      'The cron endpoint is secret-guarded and idempotent',
      'Failed jobs keep their error and retry count instead of disappearing',
      'Health checks answer from live configuration, not a hard-coded page',
    ],
  };
}

// ---------------------------------------------------------------------------
// Ledger — Finance
// ---------------------------------------------------------------------------
export function ledgerBriefing(s: TeamSignals): AgentBriefing {
  const net = s.orders.revenueWindowPaise - s.orders.refundedWindowPaise;
  const status: AgentStatus =
    s.payments.awaitingVerification > 0 || s.payments.failedWindow > 0
      ? 'ACT'
      : s.refunds.requested > 0
        ? 'WATCH'
        : 'CLEAR';

  const priorities: string[] = [];
  if (s.payments.awaitingVerification > 0)
    priorities.push(
      `Match ${s.payments.awaitingVerification} UPI payment${s.payments.awaitingVerification === 1 ? '' : 's'} to a bank credit, then confirm or reject`
    );
  if (s.payments.failedWindow > 0)
    priorities.push(
      `Check ${s.payments.failedWindow} failed payment attempt${s.payments.failedWindow === 1 ? '' : 's'} for money debited but not confirmed`
    );
  if (s.refunds.requested > 0)
    priorities.push(
      `Settle ${s.refunds.requested} requested refund${s.refunds.requested === 1 ? '' : 's'}`
    );
  if (!s.store.businessComplete)
    priorities.push('Complete legal name, address and GSTIN so invoices are compliant');

  return {
    agentId: 'ledger',
    status,
    headline:
      s.payments.awaitingVerification > 0
        ? `${s.payments.awaitingVerification} UPI payment${s.payments.awaitingVerification === 1 ? '' : 's'} waiting for bank verification.`
        : `${formatINR(net)} net collected in the last ${s.windowDays} days.`,
    summary:
      `${formatINR(s.orders.revenueWindowPaise)} collected, ${formatINR(s.orders.refundedWindowPaise)} refunded. ` +
      'Only orders with a confirmed payment count as revenue; placed-but-unpaid orders are never treated as sales. ' +
      'UPI credits are confirmed by the owner against the bank statement — no agent moves money.',
    findings: [
      f('Collected', formatINR(s.orders.revenueWindowPaise), 'DERIVED', 'Paid orders, window'),
      f('Refunded', formatINR(s.orders.refundedWindowPaise), 'DERIVED'),
      f('Net', formatINR(net), 'DERIVED'),
      f('Awaiting UPI verification', String(s.payments.awaitingVerification)),
      f('Failed attempts', String(s.payments.failedWindow)),
      f('Open refunds', String(s.refunds.requested + s.refunds.processing)),
    ],
    priorities: priorities.slice(0, 5),
    handled: [
      'Profit ledger is recomputed on every financial change',
      'Refund accounting is recorded, not inferred',
      'Payment confirmation is owner-only by design',
    ],
  };
}

// ---------------------------------------------------------------------------
// Atlas — Fulfilment & Supply
// ---------------------------------------------------------------------------
export function atlasBriefing(s: TeamSignals): AgentBriefing {
  const supplyRisk = s.catalog.outOfStock + s.catalog.lowStock + s.suppliers.failingSync;
  const status: AgentStatus =
    s.orders.overdueDispatch > 0 || s.catalog.outOfStock > 0
      ? 'ACT'
      : supplyRisk > 0 || s.catalog.withoutSupplierLink > 0
        ? 'WATCH'
        : 'CLEAR';

  const priorities: string[] = [];
  if (s.orders.overdueDispatch > 0)
    priorities.push(
      `Dispatch or escalate ${s.orders.overdueDispatch} paid order${s.orders.overdueDispatch === 1 ? '' : 's'} older than 24 h`
    );
  if (s.catalog.outOfStock > 0)
    priorities.push(
      `Restock or pause ${s.catalog.outOfStock} out-of-stock product${s.catalog.outOfStock === 1 ? '' : 's'}`
    );
  if (s.catalog.lowStock > 0)
    priorities.push(
      `Restock ${s.catalog.lowStock} low-stock product${s.catalog.lowStock === 1 ? '' : 's'} before they run out`
    );
  if (s.suppliers.failingSync > 0)
    priorities.push(
      `Re-run ${s.suppliers.failingSync} failed supplier sync${s.suppliers.failingSync === 1 ? '' : 's'}`
    );
  if (s.suppliers.unmapped > 0)
    priorities.push(
      `Map ${s.suppliers.unmapped} supplier SKU${s.suppliers.unmapped === 1 ? '' : 's'} to a store product`
    );
  if (s.suppliers.active === 0) priorities.push('Add a supplier so orders have somewhere to go');

  return {
    agentId: 'atlas',
    status,
    headline:
      s.orders.overdueDispatch > 0
        ? `${s.orders.overdueDispatch} paid order${s.orders.overdueDispatch === 1 ? '' : 's'} still not dispatched after 24 h.`
        : `${s.catalog.active} live product${s.catalog.active === 1 ? '' : 's'}, ${s.catalog.outOfStock} out of stock, ${s.catalog.lowStock} low.`,
    summary:
      `${s.suppliers.active} active supplier${s.suppliers.active === 1 ? '' : 's'}, ${s.suppliers.unmapped} unmapped SKU${s.suppliers.unmapped === 1 ? '' : 's'}, ` +
      `${s.orders.awaitingFulfilment} order${s.orders.awaitingFulfilment === 1 ? '' : 's'} awaiting fulfilment. ` +
      'Stock is reserved atomically at order time, so two customers cannot buy the last unit.',
    findings: [
      f('Awaiting fulfilment', String(s.orders.awaitingFulfilment)),
      f('Overdue dispatch', String(s.orders.overdueDispatch)),
      f('Out of stock', String(s.catalog.outOfStock)),
      f('Low stock', String(s.catalog.lowStock)),
      f('Supplier sync failures', String(s.suppliers.failingSync)),
      f('Unmapped SKUs', String(s.suppliers.unmapped)),
    ],
    priorities: priorities.slice(0, 6),
    handled: [
      'Inventory is reserved transactionally at order time',
      'Cancel and return paths restock automatically',
      'Supplier sync failures are recorded with their error',
    ],
  };
}

export const BRIEFING_BUILDERS = {
  orion: orionBriefing,
  vesper: vesperBriefing,
  kaizen: kaizenBriefing,
  lumen: lumenBriefing,
  anchor: anchorBriefing,
  sentinel: sentinelBriefing,
  ledger: ledgerBriefing,
  atlas: atlasBriefing,
} as const;

/** Build every agent's briefing for one cycle. */
export function buildTeamBriefings(signals: TeamSignals): AgentBriefing[] {
  const briefings = Object.values(BRIEFING_BUILDERS).map((build) => build(signals));
  return briefings.sort((a, b) => {
    const rank = (s: AgentStatus) => (s === 'ACT' ? 0 : s === 'WATCH' ? 1 : 2);
    return rank(a.status) - rank(b.status);
  });
}
