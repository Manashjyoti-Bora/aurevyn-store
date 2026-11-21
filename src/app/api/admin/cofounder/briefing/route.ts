import { apiRoute, jsonOk } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth/guards';
import { loadVoiceBriefing } from '@/lib/cofounder/voice';

export const dynamic = 'force-dynamic';

/**
 * The 24×7 voice reads this on a timer. Every number is a live record read;
 * the browser only speaks the script it is given.
 */
export const GET = apiRoute(async () => {
  await requireAdmin();
  return jsonOk(await loadVoiceBriefing());
});
