import { ApiError, apiRoute, badRequest, jsonOk } from '@/lib/errors';
import { requireStaff } from '@/lib/auth/guards';
import { assertRateLimit } from '@/lib/rate-limit';
import { readJson } from '@/lib/http';
import { cofounderChatSchema } from '@/lib/validation/schemas';
import { answerCofounder } from '@/lib/cofounder/service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cofounder/chat
 *
 * Read-only operator chat for STAFF/ADMIN. Answers are computed from one
 * bounded database snapshot plus counts taken for this request; nothing is
 * written, no customer is contacted and no order is changed.
 */
export const POST = apiRoute(async (req: Request) => {
  const user = await requireStaff();
  await assertRateLimit(`cofounder:${user.id}`, { limit: 30, windowMs: 5 * 60_000 });

  const raw = await readJson(req, { maxBytes: 8_000 });
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = cofounderChatSchema.parse(raw);

  const result = await answerCofounder(body.message);
  if (!result.ok) {
    throw new ApiError(
      503,
      'Verified store data is unavailable right now. Nothing was guessed or invented.',
      'STORE_DATA_UNAVAILABLE'
    );
  }

  return jsonOk(result.answer, { headers: { 'cache-control': 'no-store' } });
});
