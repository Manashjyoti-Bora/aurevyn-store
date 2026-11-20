import QRCode from 'qrcode';
import { apiRoute, jsonOk, badRequest, conflict, ApiError } from '@/lib/errors';
import { createPaymentSchema } from '@/lib/validation/schemas';
import { findOrderForAccess } from '@/lib/orders/access';
import { getCurrentUser } from '@/lib/auth/guards';
import { getPaymentProvider } from '@/lib/payments';
import { prisma } from '@/lib/db';
import { toPaise } from '@/lib/money';
import { getSettings } from '@/lib/settings';
import { assertRateLimit } from '@/lib/rate-limit';
import { clientIp, readJson } from '@/lib/http';
import { recordOrderEvent } from '@/lib/orders/state';

export const dynamic = 'force-dynamic';

const PAYABLE_ORDER_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_FAILED'];
const ALREADY_SETTLED_PAYMENT_STATUSES = ['PAID', 'REFUNDED', 'PARTIALLY_REFUNDED'];

/**
 * Creates (or reopens) a payment attempt for an existing store order.
 *
 * The amount ALWAYS comes from the stored order total - never from the client -
 * so the payable amount cannot be manipulated. Re-opening the payment page
 * reuses the unpaid attempt instead of spraying duplicate rows.
 */
export const POST = apiRoute(async (req: Request) => {
  const ip = clientIp(req) ?? 'local';
  await assertRateLimit(`pay-create:${ip}`, { limit: 30, windowMs: 10 * 60_000 });

  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = createPaymentSchema.parse(raw);

  const user = await getCurrentUser();
  const order = await findOrderForAccess(body.orderNumber, user, body.email ?? null);

  if (ALREADY_SETTLED_PAYMENT_STATUSES.includes(order.paymentStatus)) {
    throw conflict(
      `This order does not need payment (status: ${order.status.replace(/_/g, ' ')}).`
    );
  }
  if (order.paymentMethod === 'COD') {
    throw conflict('This is a Cash-on-Delivery order; no online payment is required.');
  }
  if (!PAYABLE_ORDER_STATUSES.includes(order.status)) {
    throw conflict(`Payment is not possible in order status ${order.status.replace(/_/g, ' ')}.`);
  }

  const [provider, settings] = await Promise.all([getPaymentProvider(), getSettings()]);
  if (!provider) {
    throw new ApiError(
      503,
      'UPI QR payments are not configured on this store yet. The owner must set the store UPI ID in Admin → Settings → Payments (or UPI_VPA in the environment), or enable Cash on Delivery.',
      'PAYMENTS_NOT_CONFIGURED'
    );
  }

  const amountPaise = toPaise(order.grandTotal);
  if (amountPaise <= 0) throw conflict('Order total must be greater than zero.');

  // One unpaid attempt per order+provider: reuse it so retries and reopened
  // pages keep a single durable payment row.
  const attempt = await prisma.payment.findFirst({
    where: { orderId: order.id, provider: provider.kind, status: 'CREATED' },
    orderBy: { createdAt: 'desc' },
  });

  const created = await provider.createPaymentOrder({
    orderId: order.id,
    orderNumber: order.orderNumber,
    amountPaise,
    currency: order.currency,
    customer: {
      name: order.user?.name ?? order.guestName ?? undefined,
      email: order.user?.email ?? order.guestEmail ?? undefined,
      phone: order.user?.phone ?? order.guestPhone ?? undefined,
    },
  });

  if (attempt) {
    // Keep the stored attempt id stable for the browser and the audit trail;
    // only the freshly rendered payment details are returned.
    await prisma.payment.update({
      where: { id: attempt.id },
      data: {
        amount: (amountPaise / 100).toFixed(2),
        currency: created.currency,
        method: provider.kind === 'UPI' ? 'UPI' : null,
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: created.provider,
        providerOrderId: created.providerOrderId,
        amount: (amountPaise / 100).toFixed(2),
        currency: created.currency,
        status: 'CREATED',
        method: created.provider === 'UPI' ? 'UPI' : null,
      },
    });
    await recordOrderEvent({
      orderId: order.id,
      type: 'PAYMENT_INITIATED',
      message: `Payment request created via ${created.provider} (${created.providerOrderId})`,
      actorType: 'CUSTOMER',
      actorId: user?.id ?? null,
    });
  }

  // Rendered server-side: the browser needs no QR library and no payment
  // details ever reach a third-party image service.
  const qrDataUrl =
    created.checkoutMode === 'upi-qr' && created.upiUri
      ? await QRCode.toDataURL(created.upiUri, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 512,
          color: { dark: '#0A0A0C', light: '#FFFFFF' },
        })
      : null;

  return jsonOk({
    mode: created.checkoutMode,
    provider: created.provider,
    providerOrderId: attempt?.providerOrderId ?? created.providerOrderId,
    amountPaise,
    currency: created.currency,
    orderNumber: order.orderNumber,
    qrDataUrl,
    upiUri: created.upiUri ?? null,
    upiVpa: created.notes?.vpa ?? null,
    upiPayeeName: created.notes?.payeeName ?? null,
    storeName: settings.storeName,
    prefill: {
      name: order.user?.name ?? order.guestName ?? '',
      email: order.user?.email ?? order.guestEmail ?? '',
      contact: order.user?.phone ?? order.guestPhone ?? '',
    },
  });
});
