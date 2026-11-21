import { apiRoute, jsonOk, unauthorized } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/guards';
import { toPaise } from '@/lib/money';

export const dynamic = 'force-dynamic';

/**
 * Recent orders for the owner's voice-alert assistant.
 *
 * Returns orders placed in the last 15 minutes (or since `?since=`, an ISO
 * timestamp). Each row carries the customer name, the grand total and the
 * store's estimated profit in integer paise, so the owner's browser can read
 * the order aloud and say exactly how much margin was earned.
 *
 * This is a read-only, admin-only endpoint — no CSRF token, no mutation.
 */
export async function GET(req: Request) {
  return apiRoute(async () => {
    const user = await getCurrentUser();
    if (!user || user.role !== 'ADMIN') throw unauthorized('Admin access required');

    const url = new URL(req.url);
    const sinceParam = url.searchParams.get('since');
    let since = new Date(Date.now() - 15 * 60_000);
    if (sinceParam) {
      const parsed = new Date(sinceParam);
      if (!Number.isNaN(parsed.getTime())) since = parsed;
    }

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        grandTotal: true,
        estimatedProfit: true,
        createdAt: true,
        guestName: true,
        user: { select: { name: true } },
      },
    });

    return jsonOk({
      serverTime: new Date().toISOString(),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.guestName ?? o.user?.name ?? 'Customer',
        grandTotalPaise: toPaise(o.grandTotal),
        estimatedProfitPaise: toPaise(o.estimatedProfit),
        createdAt: o.createdAt.toISOString(),
      })),
    });
  })(req, undefined);
}
