import { z } from 'zod';
import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { recheckKnowledgeEntry } from '@/lib/jarvis/knowledge-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  verifiedOn: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
});

/** Record that a source was re-read today, which clears the staleness flag. */
export async function POST(req: Request, ctx: Ctx): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('jarvis-knowledge-recheck', 30);
    const { id } = await ctx.params;
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = schema.parse(raw);
    const entry = await recheckKnowledgeEntry(id, body.verifiedOn, {
      id: admin.id,
      email: admin.email,
    });
    return jsonOk({ entry });
  })(req, {});
}
