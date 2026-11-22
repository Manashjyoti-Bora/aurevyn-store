import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { safeEqual } from '@/lib/crypto';
import { logger } from '@/lib/logger';
import { syncIncidents } from '@/lib/jarvis/incidents';

export const dynamic = 'force-dynamic';

/**
 * Scheduled incident detection (blueprint V3 §15).
 *
 * Same CRON_SECRET guard as the job and team endpoints. It only reads live
 * signals and writes/refreshes incident records; it never changes an order,
 * payment or customer record.
 */
async function handleCron(req: Request): Promise<Response> {
  if (!env.CRON_SECRET) {
    logger.error('Incident cron called but CRON_SECRET is not configured');
    return NextResponse.json({ ok: false, error: 'Cron is not configured' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !safeEqual(token, env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: 'Invalid cron secret' }, { status: 401 });
  }

  try {
    const result = await syncIncidents();
    return NextResponse.json({ ok: true, incidents: result });
  } catch (error) {
    logger.error('Incident scan failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: 'Scan failed' }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<Response> {
  return handleCron(req);
}

/** Vercel Cron uses GET with `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: Request): Promise<Response> {
  return handleCron(req);
}
