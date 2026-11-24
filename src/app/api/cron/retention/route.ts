import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { runRetentionSweep } from '@/lib/privacy/service';

export const dynamic = 'force-dynamic';

/**
 * Scheduled data-retention sweep (blueprint V4 §5, V5 §12.5/§13).
 *
 * Same CRON_SECRET guard as the job, team and incident endpoints. It deletes
 * only diagnostic and already-closed rows; orders, payments, refunds,
 * shipments and supplier records are never selected.
 *
 * The daily `/api/cron/jobs` run also performs this sweep, so a separate
 * scheduler is optional. This endpoint exists for an external scheduler
 * (cron-job.org, GitHub Actions) or a manual owner-triggered run.
 */
async function handleCron(req: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    logger.error('Retention cron called but CRON_SECRET is not configured');
    return NextResponse.json({ ok: false, error: 'Cron is not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'Invalid cron secret' }, { status: 401 });
  }

  try {
    const result = await runRetentionSweep();
    return NextResponse.json({ ok: true, retention: result });
  } catch (error) {
    logger.error('Retention sweep failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: 'Sweep failed' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  return handleCron(req);
}

/** Vercel Cron uses GET with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request): Promise<Response> {
  return handleCron(req);
}
