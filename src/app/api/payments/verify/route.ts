import { apiRoute, jsonOk, badRequest, notFound, conflict } from '@/lib/errors';
import { verifyPaymentSchema } from '@/lib/validation/schemas';
import { findOrderForAccess } from '@/lib/orders/access';
import { getCurrentUser } from '@/lib/auth/guards';
import { getPaymentProvider } from '@/lib/payments';
import { confirmPaymentResult } from '@/lib/payments/confirm';
import { prisma } from '@/lib/db';
import { assertRateLimit } from '@/lib/rate-limit';
import { clientIp, readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * Automated payment verification.
 *
 * UPI QR payments have no gateway to verify against, so this endpoint refuses
 * them outright: a customer can never mark their own order paid. Only an
 * admin, after matching the UTR against the bank statement, can confirm.
 * The TEST provider keeps its isolated simulator.
 */
export const POST = apiRoute(async (req: Request) => {
  const ip = clientIp(req) ?? 'local';
  await assertRateLimit(`pay-verify:${ip}`, { limit: 30, windowMs: 10 * 60_000 });

  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = verifyPaymentSchema.parse(raw);

  const user = await getCurrentUser();
  const order = await findOrderForAccess(body.orderNumber, user, body.email ?? null);

  const payment = await prisma.payment.findUnique({
    where: { providerOrderId: body.providerOrderId },
  });
  if (!payment || payment.orderId !== order.id) {
    throw notFound('No matching payment attempt found for this order.');
  }
  if (payment.status === 'PAID') {
    return jsonOk({ status: 'PAID', redirect: `/order/${order.orderNumber}/confirmation` });
  }

  if (payment.provider === 'UPI') {
    throw conflict(
      'UPI payments are confirmed by the store after your transaction reference is verified against the bank statement. Nothing else is needed from you.'
    );
  }

  const provider = await getPaymentProvider();
  if (!provider || provider.kind !== payment.provider) {
    throw conflict(
      payment.provider === 'TEST'
        ? 'This is a TEST-mode payment; use the test simulator to complete it.'
        : 'The configured payment provider does not match this payment attempt.'
    );
  }

  const verification = await provider.verifyPayment({
    providerOrderId: body.providerOrderId,
    providerPaymentId: body.providerPaymentId ?? payment.providerPaymentId ?? undefined,
    signature: body.signature,
  });

  if (verification.outcome === 'FAILED') {
    await confirmPaymentResult({
      orderId: order.id,
      provider: payment.provider,
      providerOrderId: body.providerOrderId,
      providerPaymentId: verification.providerPaymentId ?? body.providerPaymentId,
      outcome: 'FAILED',
      failureReason: verification.failureReason ?? 'Payment failed or was cancelled',
      actorType: 'PAYMENT_PROVIDER',
    });
    return jsonOk({
      status: 'FAILED',
      reason: verification.failureReason ?? 'Payment failed or was cancelled',
      redirect: `/checkout/payment/${order.orderNumber}`,
    });
  }

  return jsonOk({
    status: 'PENDING',
    redirect: `/order/${order.orderNumber}/confirmation`,
  });
});
