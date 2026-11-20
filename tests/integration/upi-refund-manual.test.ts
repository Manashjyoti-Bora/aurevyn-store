import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createRefund, settleRefund } from '@/lib/payments/refunds';
import { toPaise } from '@/lib/money';
import { cleanupTestData, createTestUser, testEmail, unique } from './fixtures';

/**
 * UPI refunds are manual: there is no gateway to call back into. A UPI refund
 * must therefore
 *   - never complete itself,
 *   - stay parked in REQUESTED with an actionable note (money stays reserved so
 *     it cannot be refunded twice),
 *   - complete only when an admin records the payout reference, which then
 *     updates the payment, order and profit ledgers.
 */
describe('manual UPI refund lifecycle', () => {
  let userId: string;

  beforeAll(async () => {
    await cleanupTestData();
    userId = (await createTestUser({ role: 'ADMIN' })).id;
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  async function makeUpiPaidOrder(amountPaise = 129_900) {
    const order = await prisma.order.create({
      data: {
        orderNumber: unique('ITEST-UPI-REFUND').toUpperCase(),
        userId,
        guestEmail: testEmail('upi-refund-guest'),
        status: 'ORDER_CONFIRMED',
        paymentStatus: 'PAID',
        paymentMethod: 'PREPAID_GATEWAY',
        subtotal: (amountPaise / 100).toFixed(2),
        grandTotal: (amountPaise / 100).toFixed(2),
        shippingAddress: { synthetic: true },
        paidAt: new Date(),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: 'UPI',
        providerOrderId: unique('itest-upi-provider-order'),
        providerPaymentId: '419283746501',
        amount: (amountPaise / 100).toFixed(2),
        status: 'PAID',
        method: 'UPI',
        feeIsEstimate: false,
        paidAt: new Date(),
      },
    });
    return { order, payment };
  }

  it('parks the refund for a human and settles only with a payout reference', async () => {
    const { order, payment } = await makeUpiPaidOrder();

    const created = await createRefund({
      orderId: order.id,
      amountPaise: 129_900,
      reason: 'Manual UPI refund test',
      actor: 'ADMIN',
      actorId: userId,
    });

    const parked = await prisma.refund.findUniqueOrThrow({ where: { id: created.refundId } });
    expect(parked.status).toBe('REQUESTED');
    expect(parked.provider).toBe('UPI');
    expect(parked.providerRefundId).toBeNull();
    expect(parked.failureReason).toBeTruthy();
    // Money stays reserved: a second refund for the same amount is refused.
    await expect(
      createRefund({
        orderId: order.id,
        amountPaise: 129_900,
        reason: 'Duplicate attempt',
        actor: 'ADMIN',
        actorId: userId,
      })
    ).rejects.toThrow(/exceeds refundable balance/i);

    const settled = await settleRefund({
      refundId: created.refundId,
      status: 'COMPLETED',
      providerRefundId: 'NEFT-REF-99887766',
      note: 'Paid out by UPI',
      actor: 'ADMIN',
      actorId: userId,
    });
    expect(settled).toBe(true);

    const refund = await prisma.refund.findUniqueOrThrow({ where: { id: created.refundId } });
    expect(refund.status).toBe('COMPLETED');
    expect(refund.providerRefundId).toBe('NEFT-REF-99887766');

    const refreshedPayment = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(refreshedPayment.status).toBe('REFUNDED');
    expect(toPaise(refreshedPayment.refundedTotal)).toBe(129_900);

    const refreshedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(refreshedOrder.paymentStatus).toBe('REFUNDED');
    expect(refreshedOrder.status).toBe('REFUNDED');
    expect(toPaise(refreshedOrder.refundedTotal)).toBe(129_900);

    // A completed refund is terminal.
    await expect(
      settleRefund({ refundId: created.refundId, status: 'FAILED', actor: 'ADMIN' })
    ).resolves.toBe(false);
  });
});
