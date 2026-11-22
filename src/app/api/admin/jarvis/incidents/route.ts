import { z } from 'zod';
import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdmin, requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { prisma } from '@/lib/db';
import {
  acknowledgeIncident,
  resolveIncident,
  syncIncidents,
} from '@/lib/jarvis/incidents';

export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sync') }),
  z.object({ action: z.literal('acknowledge'), id: z.string().min(1).max(64) }),
  z.object({
    action: z.literal('resolve'),
    id: z.string().min(1).max(64),
    resolution: z.string().trim().min(5).max(2000),
    followUp: z.string().trim().max(2000).nullable().optional(),
  }),
]);

export const GET = apiRoute(
  async () => {
    await requireAdmin();
    return jsonOk({
      incidents: await prisma.jarvisIncident.findMany({
        orderBy: [{ detectedAt: 'desc' }],
        take: 100,
      }),
    });
  },
  { csrf: false }
);

/** Run a detection scan, acknowledge an incident, or resolve it with a note. */
export async function POST(req: Request): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('jarvis-incidents', 20);
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = actionSchema.parse(raw);

    if (body.action === 'sync') {
      return jsonOk({ result: await syncIncidents() });
    }
    if (body.action === 'acknowledge') {
      await acknowledgeIncident(body.id, { id: admin.id, email: admin.email });
      return jsonOk({ id: body.id, status: 'ACKNOWLEDGED' });
    }
    await resolveIncident(body.id, { id: admin.id, email: admin.email }, body.resolution, body.followUp ?? undefined);
    return jsonOk({ id: body.id, status: 'RESOLVED' });
  })(req, {});
}
