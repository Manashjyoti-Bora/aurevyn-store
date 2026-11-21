import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { recordMeeshoOrderPlacement } from '@/lib/orders/fulfilment';
import { auditLog } from '@/lib/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  meeshoOrderId: z.string().trim().min(6).max(48),
});

/**
 * Hand the team the Meesho order ID.
 *
 * This is the one hand-off the owner performs. Everything after it — customer
 * confirmation, dispatch updates, delivery messages — is handled from the
 * order pipeline without another manual step.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('meesho-placement', 30);
    const { id } = await ctx.params;
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = schema.parse(raw);

    const result = await recordMeeshoOrderPlacement({
      supplierOrderId: id,
      meeshoOrderId: body.meeshoOrderId,
      adminId: admin.id,
    });

    await auditLog({
      actor: { id: admin.id, email: admin.email },
      action: 'supplier_order.meesho_placed',
      entityType: 'SupplierOrder',
      entityId: id,
      data: { meeshoOrderId: result.meeshoOrderId, orderNumber: result.orderNumber },
      req,
    });

    return jsonOk(result);
  })(req, ctx);
}
