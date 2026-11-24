import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { processDueJobs } from '@/lib/jobs/runner';
import { purgeExpiredSessions } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { purgeExpiredRateLimitBuckets } from '@/lib/rate-limit';
import { runTeamCycle } from '@/lib/team/service';
import { runRetentionSweep } from '@/lib/privacy/service';

export const dynamic = 'force-dynamic';

/**
 * Cron entrypoint for reliable background processing.
 *
 * Protected by CRON_SECRET (Authorization: Bearer <CRON_SECRET>) so it can be
 * called by cron-job.org / Vercel Cron / GitHub Actions without exposing job
 * processing to the public. Also performs housekeeping (expired sessions,
 * abandoned carts).
 *
 * Recommended schedule: every 5 minutes.
 */
async function handleCron(req: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    logger.error('Cron called but CRON_SECRET is not configured');
    return NextResponse.json({ ok: false, error: 'Cron is not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'Invalid cron secret' }, { status: 401 });
  }

  const stats = await processDueJobs({ limit: 25 });
  const sessionsPurged = await purgeExpiredSessions();
  const cartsPurged = await prisma.cart.deleteMany({
    where: { expiresAt: { lt: new Date() }, convertedOrderId: null, userId: null },
  });
  const rateLimitBucketsPurged = await purgeExpiredRateLimitBuckets();

  // Data-retention policy (V4 §5, V5 §12.5): a failure here must never stop
  // job processing or the team cycle.
  let retention: Awaited<ReturnType<typeof runRetentionSweep>> | null = null;
  try {
    retention = await runRetentionSweep();
  } catch (error) {
    logger.error('Retention sweep failed during daily cron', { error });
  }

  // The daily cron also drives one autonomous-team cycle, so the team keeps
  // working even if only Vercel Cron is configured. A failure here must never
  // fail the housekeeping run.
  let team: { cycleId: string; counts: Record<string, number> } | null = null;
  try {
    const cycle = await runTeamCycle({ trigger: 'CRON' });
    team = { cycleId: cycle.cycleId, counts: cycle.counts };
  } catch (error) {
    logger.error('Team cycle failed during daily cron', { error });
  }

  return NextResponse.json({
    ok: true,
    jobs: stats,
    housekeeping: { sessionsPurged, cartsPurged: cartsPurged.count, rateLimitBucketsPurged },
    retention,
    team,
  });
}

export async function POST(req: Request): Promise<Response> {
  return handleCron(req);
}

/**
 * Vercel Cron invokes scheduled jobs with GET and sends
 * `Authorization: Bearer $CRON_SECRET` automatically. Same guard as POST.
 */
export async function GET(req: Request): Promise<Response> {
  return handleCron(req);
}
