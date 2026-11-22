import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { runTeamCycle } from '@/lib/team/service';
import { isPaused } from '@/lib/jarvis/pause';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cron entrypoint for the autonomous team.
 *
 * Same guard as /api/cron/jobs: `Authorization: Bearer $CRON_SECRET`. Point
 * any scheduler here (Vercel Cron, cron-job.org, GitHub Actions) every three
 * hours. Each call stores one cycle of briefings; it never mutates a product,
 * price, order or customer record.
 */
async function handleCron(req: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    logger.error('Team cron called but CRON_SECRET is not configured');
    return NextResponse.json({ ok: false, error: 'Cron is not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'Invalid cron secret' }, { status: 401 });
  }

  try {
    if (await isPaused('agents')) {
      logger.warn('Team cron skipped: agents are paused from the Jarvis panel');
      return NextResponse.json({ ok: true, paused: true, reason: 'agents_paused' });
    }
    const result = await runTeamCycle({ trigger: 'CRON' });
    return NextResponse.json({
      ok: true,
      cycleId: result.cycleId,
      counts: result.counts,
      durationMs: result.durationMs,
    });
  } catch (error) {
    logger.error('Team cycle failed', { error });
    return NextResponse.json({ ok: false, error: 'Team cycle failed' }, { status: 500 });
  }
}

export async function GET(req: Request): Promise<Response> {
  return handleCron(req);
}

export async function POST(req: Request): Promise<Response> {
  return handleCron(req);
}
