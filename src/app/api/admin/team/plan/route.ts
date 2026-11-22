import { z } from 'zod';
import { apiRoute, jsonOk } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { OBJECTIVES, planWorkflow } from '@/lib/team/workflow';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  objective: z.string().trim().min(1).max(60).optional(),
});

/**
 * POST /api/admin/team/plan
 *
 * Returns the execution plan for one objective (or all of them) as JSON, so an
 * external scheduler can read the same graph the admin console renders. The
 * planner is pure: this endpoint touches no business record.
 */
export const POST = apiRoute(async (request) => {
  await requireAdminWrite('team-plan', 20);
  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  const objective = parsed.success ? parsed.data.objective : undefined;

  const plans =
    objective && objective !== 'all'
      ? [planWorkflow(objective)]
      : OBJECTIVES.map((entry) => planWorkflow(entry.id));

  return jsonOk(
    { generatedAt: new Date().toISOString(), plans },
    { headers: { 'cache-control': 'no-store' } }
  );
});
