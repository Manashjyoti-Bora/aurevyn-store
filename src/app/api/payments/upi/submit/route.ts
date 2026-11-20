import { apiRoute, jsonOk, badRequest, conflict, notFound } from '@/lib/errors';
import { upiSubmitSchema } from '@/lib/validation/schemas';
import { findOrderForAccess } from '@/lib/orders/access';
import { getCurrentUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { formatINR, toPaise } from '@/lib/money';
import { assertRateLimit } from '@/lib/rate-limit';
import { clientIp, readJson } from '@/lib/http';
import { recordOrderEvent } from '@/lib/orders/state';
import { auditLog } from '@/lib/audit';
import { alertOwner } from '@/lib/notifications/owner-alert';

export const dynamic = 'force-dynamic';

/**
 * Records the customer's UPI transaction reference (UTR) against their order.
 *
 * This does NOT mark the order paid. It files the claim so an admin can match
 * it to the bank credit; only the admin confirm endpoint moves money state.
 * The UTR is stored on the payment row as the provider payment reference.
 */
export const POST = apiRoute(async (req: Request) => {
  const ip = clientIp(req) ?? 'local';
  await assertRateLimit(`upi-submit:${ip}`, { limit: 20, windowMs: 10 * 60_000 });

  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = upiSubmitSchema.parse(raw);

  const user = await getCurrentUser();
  const order = await findOrderForAccess(body.orderNumber, user, body.email ?? null);

  if (order.paymentMethod === 'COD') {
    throw conflict('This order is Cash on Delivery and needs no UPI payment.');
  }
  if (order.paymentStatus === 'PAID') {
    return jsonOk({ status: 'ALREADY_PAID' });
  }

  const payment = await prisma.payment.findFirst({
    where: { orderId: order.id, provider: 'UPI' },
    orderBy: { createdAt: 'desc' },
  });
  if (!payment) {
    throw notFound('Open the UPI payment step for this order first, then submit the reference.');
  }

  const utr = body.utr.trim().toUpperCase();
  const previous =
    payment.raw && typeof payment.raw === 'object'
      ? (payment.raw as Record<string, unknown>)
      : {};

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      method: 'UPI',
      providerPaymentId: utr,
      raw: {
        ...previous,
        upiUtr: utr,
        submittedAt: new Date().toISOString(),
        amountPaise: toPaise(payment.amount),
      },
    },
  });

  await recordOrderEvent({
    orderId: order.id,
    type: 'PAYMENT_SUBMITTED',
    message: `UPI reference ${utr} submitted by the customer; awaiting bank verification`,
    actorType: 'CUSTOMER',
    actorId: user?.id ?? null,
    data: { utr, paymentId: payment.id },
  });

  await auditLog({
    action: 'payment.upi.reference_submitted',
    actor: { id: user?.id ?? null, email: user?.email ?? order.guestEmail ?? null },
    entityType: 'Payment',
    entityId: payment.id,
    data: { orderNumber: order.orderNumber, utr },
  });

  // Tell the owner a claim is waiting to be checked — never tell the customer
  // they have paid before the bank statement confirms it.
  await alertOwner({
    title: `UPI reference submitted · ${order.orderNumber}`,
    summary: `${formatINR(toPaise(payment.amount))} claimed as paid. Match UTR ${utr} against the bank statement.`,
    details: [
      `Order: ${order.orderNumber}`,
      `Amount: ${formatINR(toPaise(payment.amount))}`,
      `UTR / RRN: ${utr}`,
      `Customer: ${user?.email ?? order.guestEmail ?? 'guest'}`,
      '',
      'Only confirm the payment after the credit appears in the store bank account.',
    ].join('\n'),
    url: '/admin/payments?status=CREATED&provider=UPI',
    ctaLabel: 'Verify and confirm',
    orderId: order.id,
    dedupeExtra: utr,
  }).catch(() => {
    // Alerting is best-effort: a mail/Telegram outage must never fail the
    // customer's submission, which is already persisted above.
  });

  return jsonOk({ status: 'SUBMITTED', utr });
});
