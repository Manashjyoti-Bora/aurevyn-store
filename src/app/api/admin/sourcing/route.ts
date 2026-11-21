import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireAdmin, requireAdminWrite } from '@/lib/auth/guards';
import { readJson } from '@/lib/http';
import { parseMeeshoSheet } from '@/lib/sourcing/meesho';
import { ingestSourcingCandidates, listSourcingCandidates } from '@/lib/sourcing/service';
import type { SourcingCandidateInput } from '@/lib/sourcing/types';

export const dynamic = 'force-dynamic';

/** The scored Meesho shortlist, best first. */
export const GET = apiRoute(async () => {
  await requireAdmin();
  return jsonOk({ candidates: await listSourcingCandidates() });
});

/**
 * Ingest a pasted Meesho sheet. Nothing is scraped: the owner supplies the
 * rows they can already see in the Meesho app, and they are scored here.
 */
export const POST = apiRoute(async (req) => {
  const admin = await requireAdminWrite('sourcing-ingest', 20);
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');

  const body = raw as { text?: unknown; candidates?: unknown };
  let candidates: SourcingCandidateInput[] = [];
  let skipped: Array<{ line: number; reason: string }> = [];

  if (typeof body.text === 'string') {
    const parsed = parseMeeshoSheet(body.text);
    candidates = parsed.candidates;
    skipped = parsed.skipped;
  } else if (Array.isArray(body.candidates)) {
    candidates = body.candidates as SourcingCandidateInput[];
  } else {
    throw badRequest('Provide a pasted sheet in "text" or a "candidates" array');
  }

  if (candidates.length === 0) {
    throw badRequest(
      skipped.length > 0
        ? `No usable row found. ${skipped[0].reason} (line ${skipped[0].line})`
        : 'No candidate rows found'
    );
  }
  if (candidates.length > 100) throw badRequest('Paste at most 100 rows at a time');

  const saved = await ingestSourcingCandidates(candidates);
  void admin;
  return jsonOk({ saved: saved.length, skipped, candidates: saved });
});
