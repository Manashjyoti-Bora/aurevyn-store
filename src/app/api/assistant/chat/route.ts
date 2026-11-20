import { apiRoute, badRequest, jsonOk } from '@/lib/errors';
import { clientIp, readJson } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { assistantChatSchema } from '@/lib/validation/schemas';
import { answerAssistant } from '@/lib/assistant/service';

export const dynamic = 'force-dynamic';

/**
 * Customer-facing concierge endpoint.
 *
 * Stateless: the client keeps the short conversation and sends it back as
 * bounded history (currently unused by the deterministic answers, which are
 * resolved per message). No customer data is stored, no order is modified and
 * no payment information is ever accepted here.
 */
export const POST = apiRoute(async (req: Request) => {
  const ip = clientIp(req) ?? 'local';
  await assertRateLimit(`assistant:${ip}`, { limit: 20, windowMs: 5 * 60_000 });

  const raw = await readJson(req, { maxBytes: 16_000 });
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = assistantChatSchema.parse(raw);

  const reply = await answerAssistant(body.message);
  return jsonOk(reply);
});
