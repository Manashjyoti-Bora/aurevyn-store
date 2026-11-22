import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { reportMeeshoOrderReference } from '@/lib/orders/fulfilment';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  meeshoOrderId: z.string().trim().min(6).max(48),
});

/**
 * Report the supplier reference the owner got after placing the purchase.
 *
 * Recording it is not verification: the customer page keeps saying supplier
 * confirmation is pending until `confirm-placement` records the evidence.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('meesho-placement', 30);
    const { id } = await ctx.params;
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = schema.parse(raw);

    const result = await reportMeeshoOrderReference({
      supplierOrderId: id,
      meeshoOrderId: body.meeshoOrderId,
      adminId: admin.id,
    });

    await auditLog({
      actor: { id: admin.id, email: admin.email },
      action: 'supplier_order.reference_reported',
      entityType: 'SupplierOrder',
      entityId: id,
      data: { meeshoOrderId: result.meeshoOrderId, orderNumber: result.orderNumber },
      req,
    });

    return jsonOk(result);
  })(req, ctx);
}
