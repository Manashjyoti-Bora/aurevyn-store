import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { confirmSupplierOrderPlacement } from '@/lib/orders/fulfilment';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  evidence: z.string().trim().min(10).max(500),
});

/**
 * Confirm a reported supplier placement.
 *
 * Requires a note describing what confirmed it. Only after this call may the
 * order advance to supplier-accepted and the customer be told it is confirmed.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('supplier-confirm', 30);
    const { id } = await ctx.params;
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = schema.parse(raw);

    const result = await confirmSupplierOrderPlacement({
      supplierOrderId: id,
      evidence: body.evidence,
      adminId: admin.id,
    });

    await auditLog({
      actor: { id: admin.id, email: admin.email },
      action: 'supplier_order.placement_confirmed',
      entityType: 'SupplierOrder',
      entityId: id,
      data: { orderNumber: result.orderNumber, meeshoOrderId: result.meeshoOrderId },
      req,
    });

    return jsonOk(result);
  })(req, ctx);
}
