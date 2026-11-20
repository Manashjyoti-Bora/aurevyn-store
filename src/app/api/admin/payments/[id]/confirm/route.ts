import { apiRoute, jsonOk, notFound, conflict } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { confirmPaymentResult } from '@/lib/payments/confirm';
import { kickJobRunner } from '@/lib/jobs/queue';
import { toPaise } from '@/lib/money';
import { auditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Admin-only: mark a UPI payment as received after matching the customer's
 * UTR against the bank statement. This is the ONLY way a UPI order becomes
 * paid — the browser can never do it.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });
    if (!payment) throw notFound('Payment not found');
    if (payment.provider !== 'UPI') {
      throw conflict('Only UPI payments are confirmed manually.');
    }
    if (payment.status === 'PAID') {
      return jsonOk({ confirmed: true, alreadyPaid: true });
    }
    if (!payment.providerPaymentId) {
      throw conflict('No UPI reference has been submitted for this payment yet.');
    }
    if (payment.order.paymentMethod === 'COD') {
      throw conflict('This order is Cash on Delivery.');
    }

    const result = await confirmPaymentResult({
      orderId: payment.orderId,
      provider: 'UPI',
      providerOrderId: payment.providerOrderId ?? payment.id,
      providerPaymentId: payment.providerPaymentId,
      outcome: 'PAID',
      amountPaise: toPaise(payment.amount),
      method: 'UPI',
      verifiedVia: 'manual-admin',
      actorType: 'ADMIN',
      raw: {
        upiUtr: payment.providerPaymentId,
        confirmedBy: admin.email,
        confirmedAt: new Date().toISOString(),
      },
    });

    await auditLog({
      action: 'payment.upi.confirmed',
      actor: { id: admin.id, email: admin.email },
      entityType: 'Payment',
      entityId: payment.id,
      data: {
        orderNumber: payment.order.orderNumber,
        utr: payment.providerPaymentId,
        outcome: result.outcome,
      },
    });

    kickJobRunner();
    return jsonOk({ confirmed: true, outcome: result.outcome });
  })(req, ctx);
}
