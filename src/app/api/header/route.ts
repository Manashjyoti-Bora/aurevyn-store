import { apiRoute, jsonOk } from '@/lib/errors';
import { getCurrentUser } from '@/lib/auth/guards';
import { getCartItemCount } from '@/lib/cart/service';
import { getWishlistViewReadOnly } from '@/lib/wishlist/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/header
 *
 * The only personalised data the storefront shell needs. Kept as one small
 * request so cached HTML never has to be re-rendered per visitor, and marked
 * private so no shared cache can ever hold another customer's counts.
 */
export const GET = apiRoute(async () => {
  const user = await getCurrentUser();
  const [cartCount, wishlist] = await Promise.all([
    getCartItemCount(user?.id ?? null),
    getWishlistViewReadOnly(user?.id ?? null),
  ]);

  return jsonOk(
    {
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } : null,
      cartCount,
      wishlistCount: wishlist.count,
    },
    { headers: { 'cache-control': 'private, no-store' } }
  );
});
