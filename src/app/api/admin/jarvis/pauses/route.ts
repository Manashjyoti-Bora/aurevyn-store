import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { updateSettings, invalidateSettingsCache } from '@/lib/settings';
import { auditLog } from '@/lib/audit';
import { PAUSE_SWITCHES, pauseState, type PauseSwitch } from '@/lib/jarvis/pause';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const schema = z.object({
  key: z.enum(['listings', 'messages', 'agents', 'automations']),
  paused: z.boolean(),
});

/** Flip one emergency switch. Every change is audited. */
export async function POST(req: Request): Promise<Response> {
  return apiRoute(async () => {
    const admin = await requireAdminWrite('jarvis-pause', 20);
    const raw = await readJson(req);
    if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
    const body = schema.parse(raw);

    const meta = PAUSE_SWITCHES.find((s) => s.key === (body.key as PauseSwitch));
    if (!meta) throw badRequest('Unknown switch');

    await updateSettings({ jarvis: { [meta.setting]: body.paused } });
    invalidateSettingsCache();

    await auditLog({
      actor: { id: admin.id, email: admin.email },
      action: body.paused ? 'jarvis.paused' : 'jarvis.resumed',
      entityType: 'Setting',
      entityId: 'store',
      data: { switch: body.key },
      req,
    });

    return jsonOk({ pauses: await pauseState() });
  })(req, {});
}
