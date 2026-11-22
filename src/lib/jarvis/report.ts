/**
 * Daily operations report (blueprint V3 §17).
 *
 * Every number carries a basis:
 *
 *   VERIFIED — read from a confirmed record (a PAID payment, a placed order,
 *              a delivered supplier leg, a finalised profit ledger).
 *   ESTIMATE — a projection (order value not yet collected, estimated profit).
 *   UNKNOWN  — data the store does not have; rendered as "unknown", never 0.
 *
 * `buildDailyReport` is pure so the labels can be tested. `loadDailyReport`
 * reads the database and is only called from an authenticated admin page.
 */

import { prisma } from '../db';
import { toPaise } from '../money';

export type MetricBasis = 'VERIFIED' | 'ESTIMATE' | 'UNKNOWN';
export type MetricUnit = 'MONEY' | 'COUNT';

export interface ReportMetric {
  key: string;
  label: string;
  /** Integer paise for MONEY, a plain count for COUNT. */
  value: number;
  unit: MetricUnit;
  basis: MetricBasis;
  note: string;
}

export interface ReportSection {
  title: string;
  metrics: ReportMetric[];
}

export interface DailyReport {
  /** UTC day covered (YYYY-MM-DD). */
  day: string;
  headline: string;
  sections: ReportSection[];
  /** Things only the owner can resolve, phrased as actions. */
  ownerQueue: string[];
}

export interface DailyReportInput {
  day: string;
  ordersPlaced: number;
  ordersPaid: number;
  codOrders: number;
  paymentsCollectedPaise: number;
  orderValuePlacedPaise: number;
  cancelledToday: number;
  refundsCompletedPaise: number;
  refundsRequested: number;
  estimatedProfitPaise: number;
  realisedProfitPaise: number;
  finalisedOrders: number;
  awaitingPlacement: number;
  unverifiedReferences: number;
  draftsAwaitingReview: number;
  newCandidates: number;
  supportMessagesNew: number;
  openIncidents: number;
  failedJobs: number;
}

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const sections: ReportSection[] = [
    {
      title: 'Money',
      metrics: [
        {
          key: 'collected',
          label: 'Payments collected',
          value: input.paymentsCollectedPaise,
          unit: 'MONEY',
          basis: 'VERIFIED',
          note: 'Sum of payments recorded as PAID today. This is money received, not order value.',
        },
        {
          key: 'order-value',
          label: 'Order value placed',
          value: input.orderValuePlacedPaise,
          unit: 'MONEY',
          basis: 'VERIFIED',
          note: 'Grand total of orders placed today. Includes COD and unpaid orders — it is not revenue.',
        },
        {
          key: 'realised-profit',
          label: 'Realised profit',
          value: input.realisedProfitPaise,
          unit: 'MONEY',
          basis: input.finalisedOrders > 0 ? 'VERIFIED' : 'UNKNOWN',
          note:
            input.finalisedOrders > 0
              ? `From ${input.finalisedOrders} finalised order${input.finalisedOrders === 1 ? '' : 's'}. Costs are actuals.`
              : 'No order finalised today, so realised profit is unknown — not zero.',
        },
        {
          key: 'estimated-profit',
          label: 'Estimated profit',
          value: input.estimatedProfitPaise,
          unit: 'MONEY',
          basis: 'ESTIMATE',
          note: 'Projection from stored cost assumptions. Never guaranteed income.',
        },
        {
          key: 'refunds-completed',
          label: 'Refunds completed',
          value: input.refundsCompletedPaise,
          unit: 'MONEY',
          basis: 'VERIFIED',
          note: 'Refunds marked COMPLETED today with a processing timestamp.',
        },
        {
          key: 'refunds-requested',
          label: 'Refunds awaiting action',
          value: input.refundsRequested,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Requested, not yet completed. No customer has been told otherwise.',
        },
      ],
    },
    {
      title: 'Orders and fulfilment',
      metrics: [
        {
          key: 'orders-placed',
          label: 'Orders placed',
          value: input.ordersPlaced,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Orders with a placement timestamp today.',
        },
        {
          key: 'orders-paid',
          label: 'Orders paid',
          value: input.ordersPaid,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Orders whose payment status is PAID today.',
        },
        {
          key: 'cod-orders',
          label: 'COD orders',
          value: input.codOrders,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Cash-on-delivery orders placed today; money is not collected yet.',
        },
        {
          key: 'awaiting-placement',
          label: 'Supplier purchases waiting on you',
          value: input.awaitingPlacement,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Queued supplier orders with no Meesho reference. Only you can place these.',
        },
        {
          key: 'unverified-references',
          label: 'References needing confirmation',
          value: input.unverifiedReferences,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Pasted supplier references with no evidence note. The customer is not told they are confirmed.',
        },
        {
          key: 'cancelled',
          label: 'Cancellations',
          value: input.cancelledToday,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Orders cancelled today with a recorded timestamp.',
        },
      ],
    },
    {
      title: 'Catalogue and support',
      metrics: [
        {
          key: 'drafts',
          label: 'Drafts awaiting review',
          value: input.draftsAwaitingReview,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Nothing here is live or promised to a customer.',
        },
        {
          key: 'candidates',
          label: 'New sourcing candidates',
          value: input.newCandidates,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Owner-entered Meesho evidence scored today.',
        },
        {
          key: 'support',
          label: 'New support messages',
          value: input.supportMessagesNew,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Unanswered contact messages. Nothing is auto-replied on the owner’s behalf.',
        },
      ],
    },
    {
      title: 'Reliability',
      metrics: [
        {
          key: 'incidents',
          label: 'Open incidents',
          value: input.openIncidents,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Detected failures with evidence, not customer-facing claims.',
        },
        {
          key: 'failed-jobs',
          label: 'Failed background jobs',
          value: input.failedJobs,
          unit: 'COUNT',
          basis: 'VERIFIED',
          note: 'Jobs that exhausted retries. Inspect the job queue before retrying.',
        },
      ],
    },
  ];

  const ownerQueue: string[] = [];
  if (input.awaitingPlacement > 0) {
    ownerQueue.push(
      `${input.awaitingPlacement} supplier purchase${input.awaitingPlacement === 1 ? '' : 's'} still need to be placed on Meesho by you.`
    );
  }
  if (input.unverifiedReferences > 0) {
    ownerQueue.push(
      `${input.unverifiedReferences} pasted supplier reference${input.unverifiedReferences === 1 ? ' is' : 's are'} unverified — record evidence before the order can be called supplier-accepted.`
    );
  }
  if (input.refundsRequested > 0) {
    ownerQueue.push(
      `${input.refundsRequested} refund${input.refundsRequested === 1 ? '' : 's'} awaiting a decision. No refund has been promised automatically.`
    );
  }
  if (input.openIncidents > 0) {
    ownerQueue.push(
      `${input.openIncidents} open incident${input.openIncidents === 1 ? '' : 's'} — review severity and recovery status.`
    );
  }

  const headline =
    input.ordersPlaced === 0
      ? 'No orders placed today. Nothing below is projected.'
      : `${input.ordersPlaced} order${input.ordersPlaced === 1 ? '' : 's'} placed today · ${input.ordersPaid} paid · ${input.awaitingPlacement} waiting on your Meesho placement.`;

  return { day: input.day, headline, sections, ownerQueue };
}

function startOfUtcDay(now: Date): Date {
  const copy = new Date(now);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export async function loadDailyReport(now: Date = new Date()): Promise<DailyReport> {
  const start = startOfUtcDay(now);
  const end = new Date(start.getTime() + 86_400_000);
  const day = start.toISOString().slice(0, 10);

  const [
    ordersPlaced,
    ordersPaid,
    codOrders,
    collected,
    orderValue,
    cancelledToday,
    refundsCompleted,
    refundsRequested,
    estimatedProfit,
    realisedProfit,
    awaitingPlacement,
    unverifiedReferences,
    draftsAwaitingReview,
    newCandidates,
    supportMessagesNew,
    openIncidents,
    failedJobs,
  ] = await Promise.all([
    prisma.order.count({ where: { placedAt: { gte: start, lt: end } } }),
    prisma.order.count({ where: { paymentStatus: 'PAID', paidAt: { gte: start, lt: end } } }),
    prisma.order.count({
      where: { paymentMethod: 'COD', placedAt: { gte: start, lt: end } },
    }),
    prisma.payment.aggregate({
      where: { status: 'PAID', paidAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { placedAt: { gte: start, lt: end } },
      _sum: { grandTotal: true },
    }),
    prisma.order.count({ where: { cancelledAt: { gte: start, lt: end } } }),
    prisma.refund.aggregate({
      where: { status: 'COMPLETED', processedAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.refund.count({ where: { status: 'REQUESTED' } }),
    prisma.order.aggregate({
      where: { placedAt: { gte: start, lt: end } },
      _sum: { estimatedProfit: true },
    }),
    prisma.order.aggregate({
      where: { profitFinalizedAt: { gte: start, lt: end } },
      _sum: { actualProfit: true },
      _count: { _all: true },
    }),
    prisma.supplierOrder.count({
      where: { supplierOrderId: null, status: { in: ['QUEUED', 'SENT'] } },
    }),
    prisma.supplierOrder.count({
      where: {
        supplierOrderId: { not: null },
        referenceVerifiedAt: null,
        status: { notIn: ['CANCELLED', 'DELIVERED', 'REJECTED', 'FAILED', 'RETURNED'] },
      },
    }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
    prisma.sourcingCandidate.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
    prisma.jarvisIncident.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
    prisma.job.count({ where: { status: 'FAILED' } }),
  ]);

  return buildDailyReport({
    day,
    ordersPlaced,
    ordersPaid,
    codOrders,
    paymentsCollectedPaise: toPaise(collected._sum.amount ?? 0),
    orderValuePlacedPaise: toPaise(orderValue._sum.grandTotal ?? 0),
    cancelledToday,
    refundsCompletedPaise: toPaise(refundsCompleted._sum.amount ?? 0),
    refundsRequested,
    estimatedProfitPaise: toPaise(estimatedProfit._sum.estimatedProfit ?? 0),
    realisedProfitPaise: toPaise(realisedProfit._sum.actualProfit ?? 0),
    finalisedOrders: realisedProfit._count._all,
    awaitingPlacement,
    unverifiedReferences,
    draftsAwaitingReview,
    newCandidates,
    supportMessagesNew,
    openIncidents,
    failedJobs,
  });
}
