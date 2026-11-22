import { z } from 'zod';
import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdmin, requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import {
  createKnowledgeEntry,
  listKnowledge,
  type KnowledgeInput,
} from '@/lib/jarvis/knowledge-service';

export const dynamic = 'force-dynamic';

const dateish = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .nullable()
  .optional();

const schema = z.object({
  title: z.string().trim().min(4).max(160),
  category: z.string().trim().min(2).max(120),
  summary: z.string().trim().min(1).max(400),
  body: z.string().trim().min(20).max(20_000),
  sourceType: z.enum(['OFFICIAL', 'PRIMARY', 'SECONDARY', 'OWNER_SUPPLIED']),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
  sourceTitle: z.string().trim().max(200).nullable().optional(),
  publishedAt: dateish,
  verifiedAt: dateish,
  confidence: z.enum(['VERIFIED', 'ESTIMATE', 'ASSUMPTION', 'RECOMMENDATION']),
});

export const GET = apiRoute(
  async () => {
    await requireAdmin();
    return jsonOk({ entries: await listKnowledge() });
  },
  { csrf: false }
);

/** Add a sourced knowledge entry. Validation of the VERIFIED rules lives in the service. */
export async function POST(req: Request): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('jarvis-knowledge', 20);
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = schema.parse(raw);
    const entry = await createKnowledgeEntry(body as KnowledgeInput, {
      id: admin.id,
      email: admin.email,
    });
    return jsonOk({ entry });
  })(req, {});
}
