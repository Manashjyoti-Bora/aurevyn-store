import { apiRoute, jsonOk } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { auditLog } from '@/lib/audit';
import { createDraftFromCandidate } from '@/lib/sourcing/service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Turn a scored candidate into a DRAFT product. Publishing is still an owner
 * action in Admin → Products; this only carries the real cost and the
 * suggested price across, so the margin is correct from the first edit.
 */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('sourcing-draft', 20);
    const { id } = await ctx.params;
    const result = await createDraftFromCandidate(id);
    await auditLog({
      actor: { id: admin.id, email: admin.email },
      action: 'sourcing.draft_created',
      entityType: 'Product',
      entityId: result.productId,
      data: { candidateId: id },
      req,
    });
    return jsonOk(result);
  })(req, ctx);
}
