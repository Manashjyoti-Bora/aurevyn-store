import { apiRoute, jsonOk, badRequest } from '@/lib/errors';
import { z } from 'zod';
import { applyCouponToCart, removeCouponFromCart } from '@/lib/cart/service';
import { getCurrentUser } from '@/lib/auth/guards';
import { clientIp, readJson } from '@/lib/http';
import { assertRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const applySchema = z.object({ code: z.string().trim().min(2).max(40) });

export const POST = apiRoute(async (req: Request) => {
  // Coupon codes are guessable - throttle application attempts per client.
  await assertRateLimit(`cart:coupon:${clientIp(req) ?? 'local'}`, {
    limit: 20,
    windowMs: 60_000,
  });
  const raw = await readJson(req);
  if (!raw || typeof raw !== 'object') throw badRequest('Invalid request body');
  const body = applySchema.parse(raw);
  const user = await getCurrentUser();
  const view = await applyCouponToCart({
    userId: user?.id ?? null,
    code: body.code,
    guestEmail: null,
  });
  return jsonOk(view);
});

export const DELETE = apiRoute(async () => {
  const user = await getCurrentUser();
  return jsonOk(await removeCouponFromCart(user?.id ?? null));
});
