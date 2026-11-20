import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { updateCartItemSchema } from '@/lib/validation/schemas';
import { removeCartItem, updateCartItemQuantity } from '@/lib/cart/service';
import { getCurrentUser } from '@/lib/auth/guards';
import { clientIp, readJson } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export const PATCH = apiRoute(async (req: Request) => {
  await assertRateLimit(`cart:item:${clientIp(req) ?? 'local'}`, {
    limit: 120,
    windowMs: 60_000,
  });
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = updateCartItemSchema.parse(raw);
  const user = await getCurrentUser();
  return jsonOk(
    await updateCartItemQuantity({
      userId: user?.id ?? null,
      itemId: body.itemId,
      quantity: body.quantity,
    })
  );
});

export const DELETE = apiRoute(async (req: Request) => {
  await assertRateLimit(`cart:item:${clientIp(req) ?? 'local'}`, {
    limit: 120,
    windowMs: 60_000,
  });
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const parsed = updateCartItemSchema.partial().parse(raw);
  if (!parsed.itemId) throw badRequest('itemId is required');
  const user = await getCurrentUser();
  return jsonOk(await removeCartItem({ userId: user?.id ?? null, itemId: parsed.itemId }));
});
