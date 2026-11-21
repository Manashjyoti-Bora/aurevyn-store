import { apiRoute, jsonOk } from '@/lib/errors';
import { requireAdminWrite } from '@/lib/auth/guards';
import { runTeamCycle } from '@/lib/team/service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/admin/team/run
 *
 * Runs one team cycle on the owner's command. ADMIN only, rate-limited per
 * admin so a stuck client cannot hammer the database. The cycle is read-only
 * with respect to business records.
 */
export const POST = apiRoute(async () => {
  const admin = await requireAdminWrite('team-run', 4);
  const result = await runTeamCycle({ trigger: 'OWNER' });
  return jsonOk(
    {
      cycleId: result.cycleId,
      createdAt: result.createdAt,
      counts: result.counts,
      durationMs: result.durationMs,
      ranBy: admin.email,
    },
    { headers: { 'cache-control': 'no-store' } }
  );
});
