import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { toPaise } from '@/lib/money';
import { loadPaymentStatus } from '@/lib/payments';
import { getSettings, isPlaceholderEmail } from '@/lib/settings';
import { collectLaunchReadiness } from '@/lib/ops/launch-blockers';
import { getAllSupplierSyncReports } from '@/lib/catalog/auto-import';
import type { TeamSignals } from './types';

/**
 * The team's single database adapter.
 *
 * One bounded read per signal, all in parallel. Every query returns counts,
 * sums or product-level cost rows — never a customer name, e-mail, phone or
 * address. Row-capped queries (`take`) are only used for margin and stock
 * maths, where the answer is a floor if the cap is reached.
 *
 * If the database is unreachable the loader throws and no briefing is stored:
 * the team never reports zeros it did not observe.
 */

export const PRODUCT_SCAN_CAP = 1000;
export const DEFAULT_TEAM_WINDOW_DAYS = 30;

const FULFILMENT_OPEN = [
  'ORDER_CONFIRMED',
  'SENT_TO_SUPPLIER',
  'SUPPLIER_ACCEPTED',
  'PROCESSING',
] as const;

export async function loadTeamSignals(now: Date = new Date()): Promise<TeamSignals> {
  const windowDays = DEFAULT_TEAM_WINDOW_DAYS;
  const since = new Date(now.getTime() - windowDays * 86_400_000);
  const dayAgo = new Date(now.getTime() - 86_400_000);
  const staleBefore = new Date(now.getTime() - 45 * 86_400_000);
  const weekAhead = new Date(now.getTime() + 7 * 86_400_000);

  const [
    settings,
    payment,
    productGroups,
    missingImage,
    withoutSupplierLink,
    stale,
    activeCostRows,
    localStockRows,
    categories,
    ordersPlacedWindow,
    deliveredWindow,
    cancelledWindow,
    awaitingFulfilment,
    overdueDispatch,
    inTransit,
    staleUnpaid,
    revenueSum,
    refundedSum,
    awaitingVerification,
    failedPaymentsWindow,
    refundsByStatus,
    returnsOpen,
    newMessages,
    oldestMessage,
    jobsByStatus,
    oldestJob,
    reviewsByStatus,
    productsWithoutReview,
    suppliersActive,
    suppliersInactive,
    unmappedSupplierProducts,
    syncReports,
    expiringCoupons,
  ] = await Promise.all([
    getSettings(),
    loadPaymentStatus(),
    prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.product.count({ where: { status: 'ACTIVE', images: { none: {} } } }),
    prisma.product.count({ where: { status: 'ACTIVE', supplierProduct: { is: null } } }),
    prisma.product.count({ where: { status: 'ACTIVE', updatedAt: { lt: staleBefore } } }),
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        sellingPrice: true,
        supplierCost: true,
        supplierShippingCost: true,
        otherCost: true,
      },
      take: PRODUCT_SCAN_CAP,
    }),
    prisma.product.findMany({
      where: { status: 'ACTIVE', stockMode: 'LOCAL', hasVariants: false },
      select: { stock: true, lowStockThreshold: true },
      take: PRODUCT_SCAN_CAP,
    }),
    prisma.category.findMany({
      select: {
        id: true,
        _count: { select: { products: { where: { status: 'ACTIVE' } } } },
      },
    }),
    prisma.order.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { status: 'DELIVERED', deliveredAt: { gte: since } } }),
    prisma.order.count({ where: { status: 'CANCELLED', cancelledAt: { gte: since } } }),
    prisma.order.count({ where: { status: { in: [...FULFILMENT_OPEN] } } }),
    prisma.order.count({
      where: {
        status: { in: [...FULFILMENT_OPEN] },
        OR: [{ paidAt: { lt: dayAgo } }, { paidAt: null, createdAt: { lt: dayAgo } }],
      },
    }),
    prisma.order.count({ where: { status: { in: ['SHIPPED', 'OUT_FOR_DELIVERY'] } } }),
    prisma.order.count({ where: { status: 'PENDING_PAYMENT', createdAt: { lt: dayAgo } } }),
    prisma.order.aggregate({
      _sum: { grandTotal: true },
      where: {
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
        paidAt: { gte: since },
      },
    }),
    prisma.order.aggregate({
      _sum: { refundedTotal: true },
      where: { createdAt: { gte: since }, refundedTotal: { gt: 0 } },
    }),
    prisma.payment.count({ where: { provider: 'UPI', status: 'CREATED' } }),
    prisma.payment.count({ where: { status: 'FAILED', createdAt: { gte: since } } }),
    prisma.refund.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.returnRequest.count({ where: { status: { in: ['REQUESTED', 'APPROVED'] } } }),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
    prisma.contactMessage.findFirst({
      where: { status: 'NEW' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.job.findFirst({
      where: { status: 'PENDING' },
      orderBy: { nextRunAt: 'asc' },
      select: { nextRunAt: true },
    }),
    prisma.productReview.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.product.count({ where: { status: 'ACTIVE', reviews: { none: {} } } }),
    prisma.supplier.count({ where: { isActive: true } }),
    prisma.supplier.count({ where: { isActive: false } }),
    prisma.supplierProduct.count({ where: { productId: null, isActive: true } }),
    getAllSupplierSyncReports(),
    prisma.coupon.count({ where: { isActive: true, endsAt: { gte: now, lte: weekAhead } } }),
  ]);

  const statusCount = (groups: Array<{ status: string; _count: { _all: number } }>, key: string) =>
    groups.find((g) => g.status === key)?._count._all ?? 0;

  // Landed cost vs selling price. A product with no recorded cost is not
  // "below cost" — it is unknown, so it is excluded from both counts.
  let belowCost = 0;
  let thinMargin = 0;
  for (const row of activeCostRows) {
    const landed =
      toPaise(row.supplierCost) + toPaise(row.supplierShippingCost) + toPaise(row.otherCost);
    const selling = toPaise(row.sellingPrice);
    if (landed <= 0 || selling <= 0) continue;
    if (selling < landed) {
      belowCost += 1;
      continue;
    }
    const marginPercent = ((selling - landed) / selling) * 100;
    if (marginPercent < settings.pricing.minMarginPercent) thinMargin += 1;
  }

  let lowStock = 0;
  let outOfStock = 0;
  for (const row of localStockRows) {
    if (row.stock <= 0) outOfStock += 1;
    else if (row.stock <= row.lowStockThreshold) lowStock += 1;
  }

  const failingSync = syncReports.filter((report) => report.status !== 'COMPLETED').length;

  const paymentConfigured = payment.kind !== 'NONE';
  const launch = collectLaunchReadiness({
    settings,
    env,
    paymentConfigured,
  });

  return {
    asOf: now.toISOString(),
    windowDays,
    store: {
      name: settings.storeName,
      demoMode: settings.demoMode,
      paymentsKind: payment.kind,
      paymentsConfigured: paymentConfigured,
      cronConfigured: Boolean(env.CRON_SECRET),
      emailLive: env.EMAIL_PROVIDER === 'smtp',
      storageDurable: env.STORAGE_PROVIDER !== 'local',
      supportEmailConfigured: !isPlaceholderEmail(settings.supportEmail),
      businessComplete: Boolean(
        settings.business.legalName && settings.business.addressLine && settings.business.gstin
      ),
    },
    catalog: {
      active: statusCount(productGroups, 'ACTIVE'),
      draft: statusCount(productGroups, 'DRAFT'),
      archived: statusCount(productGroups, 'ARCHIVED'),
      categoriesActive: categories.filter((c) => c._count.products > 0).length,
      categoriesEmpty: categories.filter((c) => c._count.products === 0).length,
      missingImage,
      lowStock,
      outOfStock,
      stale,
      withoutSupplierLink,
      belowCost,
      thinMargin,
    },
    orders: {
      awaitingFulfilment,
      overdueDispatch,
      inTransit,
      deliveredWindow,
      cancelledWindow,
      placedWindow: ordersPlacedWindow,
      staleUnpaid,
      revenueWindowPaise: toPaise(revenueSum._sum.grandTotal ?? 0),
      refundedWindowPaise: toPaise(refundedSum._sum.refundedTotal ?? 0),
    },
    payments: {
      awaitingVerification,
      failedWindow: failedPaymentsWindow,
    },
    refunds: {
      requested: statusCount(refundsByStatus, 'REQUESTED'),
      processing: statusCount(refundsByStatus, 'PROCESSING'),
    },
    returns: { open: returnsOpen },
    support: {
      newMessages,
      oldestNewAt: oldestMessage?.createdAt.toISOString() ?? null,
    },
    jobs: {
      pending: statusCount(jobsByStatus, 'PENDING'),
      failed: statusCount(jobsByStatus, 'FAILED'),
      oldestPendingAt: oldestJob?.nextRunAt.toISOString() ?? null,
    },
    reviews: {
      published: statusCount(reviewsByStatus, 'PUBLISHED'),
      pending: statusCount(reviewsByStatus, 'PENDING'),
      productsWithoutReview,
    },
    suppliers: {
      active: suppliersActive,
      inactive: suppliersInactive,
      unmapped: unmappedSupplierProducts,
      failingSync,
    },
    coupons: { expiringSoon: expiringCoupons },
    launch,
  };
}
