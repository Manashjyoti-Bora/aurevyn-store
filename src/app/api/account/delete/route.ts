import { cookies } from 'next/headers';
import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { requireUser } from '@/lib/auth/guards';
import { deleteAccountSchema } from '@/lib/validation/schemas';
import { deleteCustomerAccount } from '@/lib/account/deletion';
import { clientIp, readJson } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';
import { SESSION_COOKIE } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

/**
 * Self-service account erasure (DPDP right to erasure). Requires the current
 * password and an explicit DELETE confirmation; staff/admin accounts are
 * refused here so a store cannot be locked out by a single request.
 */
export const POST = apiRoute(async (req: Request) => {
  const user = await requireUser();
  await assertRateLimit(`account:delete:${clientIp(req) ?? 'local'}`, {
    limit: 5,
    windowMs: 15 * 60_000,
  });

  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = deleteAccountSchema.parse(raw);

  const result = await deleteCustomerAccount({
    userId: user.id,
    password: body.password,
    req,
  });

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return jsonOk(result);
});
