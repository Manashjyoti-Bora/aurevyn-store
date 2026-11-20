import { apiRoute, jsonOk, badRequest, notFound, conflict } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { settleRefund } from '@/lib/payments/refunds';
import { z } from 'zod';
import { readJson } from '@/lib/http';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const settleSchema = z.object({
  status: z.enum(['COMPLETED', 'FAILED']),
  /** Bank/UPI reference of the payout the admin actually made. */
  reference: z.string().trim().max(120).optional().or(z.literal('')).nullable(),
  note: z.string().trim().max(300).optional().or(z.literal('')).nullable(),
});

/**
 * Manual settlement for refunds the store pays out itself (every UPI refund:
 * there is no refund API to call). Recording the payout reference is what makes
 * the refund auditable against the bank statement.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const refund = await prisma.refund.findUnique({ where: { id } });
    if (!refund) throw notFound('Refund not found');
    if (refund.status === 'COMPLETED') throw conflict('This refund is already completed.');

    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = settleSchema.parse(raw);
    const reference = body.reference?.trim() || null;
    const note = body.note?.trim() || null;

    if (body.status === 'COMPLETED' && !reference && !refund.providerRefundId) {
      throw badRequest(
        'Record the bank/UPI reference of the payout before marking the refund completed.'
      );
    }

    const changed = await settleRefund({
      refundId: id,
      status: body.status,
      providerRefundId: body.status === 'COMPLETED' ? (reference ?? undefined) : undefined,
      failureReason: body.status === 'FAILED' ? (note ?? 'Marked failed by admin') : undefined,
      note: note ?? reference ?? undefined,
      actor: 'ADMIN',
      actorId: admin.id,
    });
    const latest = await prisma.refund.findUniqueOrThrow({ where: { id } });
    return jsonOk({ settled: latest.status, changed });
  })(req, ctx);
}
