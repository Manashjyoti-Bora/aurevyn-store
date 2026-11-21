import { prisma } from '@/lib/db';
import { formatINR, toPaise } from '@/lib/money';
import { getSettings } from '@/lib/settings';

/**
 * The co-founder's voice.
 *
 * The script is built from stored records only, in the same deterministic
 * style as the team briefings: same numbers in, same sentence out. The
 * fingerprint lets the 24×7 voice stay quiet until something actually
 * changed — a voice that repeats itself every five minutes is noise, not a
 * co-founder.
 *
 * It also answers the owner's real question when an order lands: which order,
 * where, how much the customer paid and what the expected margin is, so the
 * Meesho order can be placed in one pass.
 */

export interface VoiceOrderLine {
  id: string;
  orderNumber: string;
  city: string;
  totalPaise: number;
  marginPaise: number;
  itemCount: number;
  supplierOrderId: string | null;
  placedOnMeesho: boolean;
}

export interface VoiceBriefingInput {
  storeName: string;
  /** ISO timestamp; the greeting uses India time. */
  now: string;
  ordersAwaitingPlacement: VoiceOrderLine[];
  paymentsAwaitingVerification: number;
  supportNew: number;
  lowStock: number;
  outOfStock: number;
  failedJobs: number;
}

export interface VoiceBriefing {
  script: string;
  urgent: boolean;
  /** Changes only when a measured number changes. */
  fingerprint: string;
  orders: VoiceOrderLine[];
  stats: Array<{ label: string; value: string }>;
}

function greetingFor(iso: string): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(iso))
  );
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

export function buildVoiceBriefing(input: VoiceBriefingInput): VoiceBriefing {
  const orders = input.ordersAwaitingPlacement;
  const totalMargin = orders.reduce((sum, order) => sum + order.marginPaise, 0);
  const blocks: string[] = [];

  blocks.push(`${greetingFor(input.now)}. ${input.storeName} report.`);

  if (orders.length === 0) {
    blocks.push('No paid order is waiting for a Meesho order ID right now.');
  } else if (orders.length === 1) {
    const [order] = orders;
    blocks.push(
      `One paid order needs you. ${order.orderNumber}, ${order.city}, customer paid ${formatINR(
        order.totalPaise
      )}, expected margin ${formatINR(order.marginPaise)}. ` +
        (order.placedOnMeesho
          ? 'The Meesho order ID is already recorded; the team is handling the customer updates.'
          : 'Place it on Meesho, then paste the Meesho order ID into supplier orders.')
    );
  } else {
    blocks.push(
      `${orders.length} paid orders need a Meesho order ID. Combined expected margin ${formatINR(
        totalMargin
      )}.`
    );
    for (const order of orders.slice(0, 4)) {
      blocks.push(
        `${order.orderNumber}, ${order.city}, ${formatINR(order.totalPaise)}, margin ${formatINR(
          order.marginPaise
        )}.`
      );
    }
    if (orders.length > 4) blocks.push(`And ${orders.length - 4} more in the supplier orders queue.`);
  }

  const watches: string[] = [];
  if (input.paymentsAwaitingVerification > 0) {
    watches.push(`${input.paymentsAwaitingVerification} UPI payment waiting for bank verification`);
  }
  if (input.failedJobs > 0) watches.push(`${input.failedJobs} failed background job`);
  if (input.supportNew > 0) watches.push(`${input.supportNew} new customer message`);
  if (input.outOfStock > 0) watches.push(`${input.outOfStock} product sold out`);
  if (input.lowStock > 0) watches.push(`${input.lowStock} product low on stock`);

  if (watches.length > 0) blocks.push(`Also open: ${watches.join('; ')}.`);

  if (orders.length === 0 && watches.length === 0) {
    blocks.push('Everything measured is clear. The team is holding the store.');
  }

  const urgent =
    orders.length > 0 ||
    input.paymentsAwaitingVerification > 0 ||
    input.failedJobs > 0 ||
    input.outOfStock > 0;

  return {
    script: blocks.join(' '),
    urgent,
    fingerprint: JSON.stringify({
      orders: orders.map((order) => [order.orderNumber, order.placedOnMeesho]),
      payments: input.paymentsAwaitingVerification,
      support: input.supportNew,
      low: input.lowStock,
      out: input.outOfStock,
      jobs: input.failedJobs,
    }),
    orders,
    stats: [
      { label: 'Paid orders to place', value: String(orders.length) },
      { label: 'Expected margin', value: formatINR(totalMargin) },
      { label: 'Payments to verify', value: String(input.paymentsAwaitingVerification) },
      { label: 'Failed jobs', value: String(input.failedJobs) },
    ],
  };
}

const PLACEMENT_STATUSES = ['ORDER_CONFIRMED', 'SENT_TO_SUPPLIER', 'PROCESSING'] as const;
const LOW_STOCK_SCAN_CAP = 500;

/** Load the live numbers the voice is allowed to speak. */
export async function loadVoiceBriefing(now: Date = new Date()): Promise<VoiceBriefing> {
  const settings = await getSettings();

  const [orders, paymentsAwaitingVerification, supportNew, stockRows, failedJobs] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: [...PLACEMENT_STATUSES] },
        paymentStatus: { in: ['PAID', 'PARTIALLY_REFUNDED'] },
      },
      orderBy: { paidAt: 'asc' },
      take: 20,
      select: {
        id: true,
        orderNumber: true,
        grandTotal: true,
        estimatedProfit: true,
        actualProfit: true,
        shippingAddress: true,
        items: { select: { id: true } },
        supplierOrders: {
          select: { id: true, supplierOrderId: true, supplier: { select: { type: true } } },
        },
      },
    }),
    prisma.payment.count({ where: { provider: 'UPI', status: 'CREATED' } }),
    prisma.contactMessage.count({ where: { status: 'NEW' } }),
    prisma.product.findMany({
      where: { status: 'ACTIVE', hasVariants: false, stockMode: 'LOCAL' },
      select: { stock: true, lowStockThreshold: true },
      take: LOW_STOCK_SCAN_CAP,
    }),
    prisma.job.count({ where: { status: 'FAILED' } }),
  ]);

  let lowStock = 0;
  let outOfStock = 0;
  for (const row of stockRows) {
    if (row.stock <= 0) outOfStock += 1;
    else if (row.stock <= row.lowStockThreshold) lowStock += 1;
  }

  const lines: VoiceOrderLine[] = orders.map((order) => {
    const address = (order.shippingAddress ?? {}) as Record<string, unknown>;
    const city = typeof address.city === 'string' && address.city.trim() ? address.city : 'unknown city';
    const meeshoRow = order.supplierOrders.find((row) => row.supplier.type === 'MEESHO');
    const profit = toPaise(order.actualProfit) || toPaise(order.estimatedProfit);
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      city,
      totalPaise: toPaise(order.grandTotal),
      marginPaise: profit,
      itemCount: order.items.length,
      supplierOrderId: meeshoRow?.id ?? order.supplierOrders[0]?.id ?? null,
      placedOnMeesho: Boolean(meeshoRow?.supplierOrderId?.startsWith('MEESHO-')),
    };
  });

  return buildVoiceBriefing({
    storeName: settings.storeName,
    now: now.toISOString(),
    ordersAwaitingPlacement: lines,
    paymentsAwaitingVerification,
    supportNew,
    lowStock,
    outOfStock,
    failedJobs,
  });
}

