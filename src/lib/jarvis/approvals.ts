/**
 * Human approval queue (blueprint V3 §7).
 *
 * High-impact actions already require an owner session, but the owner also
 * needs to see everything *waiting* for that decision in one place. This module
 * derives the queue from live records — it never invents a pending item and it
 * never performs the action.
 */

import { prisma } from '../db';

export type ApprovalSeverity = 'HIGH' | 'NORMAL';

export interface PendingApproval {
  id: string;
  kind: string;
  title: string;
  detail: string;
  count: number;
  href: string;
  severity: ApprovalSeverity;
  /** What the owner must actually do. */
  action: string;
}

export async function collectPendingApprovals(): Promise<PendingApproval[]> {
  const [
    awaitingPlacement,
    unverifiedReferenceRows,
    refundsRequested,
    returnsRequested,
    failedJobs,
    upiAwaitingMatch,
    drafts,
  ] = await Promise.all([
    prisma.supplierOrder.count({
      where: { supplierOrderId: null, status: { in: ['QUEUED', 'SENT'] } },
    }),
    prisma.supplierOrder.findMany({
      where: {
        supplierOrderId: { not: null },
        referenceVerifiedAt: null,
        status: { notIn: ['CANCELLED', 'DELIVERED', 'REJECTED', 'FAILED', 'RETURNED'] },
      },
      orderBy: { referenceReportedAt: 'asc' },
      take: 8,
      select: { id: true, supplierOrderId: true, order: { select: { orderNumber: true } } },
    }),
    prisma.refund.count({ where: { status: { in: ['REQUESTED', 'PROCESSING'] } } }),
    prisma.returnRequest.count({ where: { status: 'REQUESTED' } }),
    prisma.job.count({ where: { status: 'FAILED' } }),
    prisma.payment.count({
      where: {
        provider: 'UPI',
        status: 'CREATED',
        createdAt: { lt: new Date(Date.now() - 30 * 60_000) },
      },
    }),
    prisma.product.count({ where: { status: 'DRAFT' } }),
  ]);

  const approvals: PendingApproval[] = [];

  if (awaitingPlacement > 0) {
    approvals.push({
      id: 'supplier-placement',
      kind: 'Supplier purchase',
      title: `${awaitingPlacement} order${awaitingPlacement === 1 ? '' : 's'} need a Meesho purchase`,
      detail: 'These customer orders have no supplier reference yet. The store cannot place them for you.',
      count: awaitingPlacement,
      href: '/admin/supplier-orders?status=QUEUED',
      severity: 'HIGH',
      action: 'Place each purchase on Meesho, then report the supplier reference.',
    });
  }

  if (unverifiedReferenceRows.length > 0) {
    for (const row of unverifiedReferenceRows) {
      approvals.push({
        id: `reference-${row.id}`,
        kind: 'Supplier confirmation',
        title: `Confirm ${row.order.orderNumber} · ${row.supplierOrderId}`,
        detail: 'A reference was reported, but no evidence was recorded. The customer is still told confirmation is pending.',
        count: 1,
        href: `/admin/supplier-orders?focus=${row.id}`,
        severity: 'HIGH',
        action: 'Confirm the placement with a written evidence note, or correct the reference.',
      });
    }
  }

  if (refundsRequested > 0) {
    approvals.push({
      id: 'refunds',
      kind: 'Refund',
      title: `${refundsRequested} refund${refundsRequested === 1 ? '' : 's'} awaiting decision`,
      detail: 'Money has not moved. No customer has been told a refund was processed.',
      count: refundsRequested,
      href: '/admin/refunds',
      severity: 'HIGH',
      action: 'Approve, process or reject each refund with a recorded reason.',
    });
  }

  if (returnsRequested > 0) {
    approvals.push({
      id: 'returns',
      kind: 'Return',
      title: `${returnsRequested} return request${returnsRequested === 1 ? '' : 's'}`,
      detail: 'Return policy windows apply; no return is approved automatically.',
      count: returnsRequested,
      href: '/admin/returns',
      severity: 'NORMAL',
      action: 'Decide each return and record the reason.',
    });
  }

  if (upiAwaitingMatch > 0) {
    approvals.push({
      id: 'upi-match',
      kind: 'Payment',
      title: `${upiAwaitingMatch} UPI payment${upiAwaitingMatch === 1 ? '' : 's'} awaiting bank match`,
      detail: 'A UTR was submitted but no payment has been marked PAID.',
      count: upiAwaitingMatch,
      href: '/admin/payments',
      severity: 'HIGH',
      action: 'Match each UTR against the bank statement and confirm or reject it.',
    });
  }

  if (drafts > 0) {
    approvals.push({
      id: 'drafts',
      kind: 'Catalogue',
      title: `${drafts} draft product${drafts === 1 ? '' : 's'} awaiting review`,
      detail: 'Drafts are invisible to customers and no stock or delivery promise has been made.',
      count: drafts,
      href: '/admin/products?status=DRAFT',
      severity: 'NORMAL',
      action: 'Check cost, evidence and images, then publish through the gated path.',
    });
  }

  if (failedJobs > 0) {
    approvals.push({
      id: 'failed-jobs',
      kind: 'Reliability',
      title: `${failedJobs} failed background job${failedJobs === 1 ? '' : 's'}`,
      detail: 'Retries are exhausted. A notification or supplier update may not have happened.',
      count: failedJobs,
      href: '/admin/logs/jobs?status=FAILED',
      severity: 'NORMAL',
      action: 'Inspect the error, then retry or close each job deliberately.',
    });
  }

  return approvals;
}
