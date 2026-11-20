import { forbidden, unauthorized } from '../errors';
import { assertRateLimit } from '../rate-limit';
import { getSessionUser, type SessionUser } from './session';

/**
 * Server-side authorization guards. Every protected page and API route MUST
 * call these - hiding buttons in the UI is never the security boundary.
 */

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSessionUser();
  return session?.user ?? null;
}

/** Requires any active authenticated user (customer, staff or admin). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Requires role STAFF or ADMIN. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
    throw forbidden('Administrator access required.');
  }
  return user;
}

/** Requires role ADMIN. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN') {
    throw forbidden('Administrator access required.');
  }
  return user;
}

/**
 * `requireAdmin` + a per-admin write budget.
 *
 * Every admin mutation (refund, role change, repricing, supplier sync, AI
 * action …) goes through this. Two independent admin bugs - a runaway client
 * loop or a stolen session - then cannot hammer a money path at wire speed.
 * The limit is per admin, per action, so normal use never notices it.
 */
export async function requireAdminWrite(action: string, limit = 60): Promise<SessionUser> {
  const admin = await requireAdmin();
  await assertRateLimit(`admin-write:${admin.id}:${action}`, { limit, windowMs: 60_000 });
  return admin;
}

/**
 * Ownership-or-admin check for customer-owned resources (orders, addresses).
 * Prevents IDOR: a customer can only reach their own records.
 */
export function assertOwnerOrAdmin(
  currentUser: SessionUser,
  resourceOwnerId: string | null | undefined
): void {
  if (currentUser.role === 'ADMIN' || currentUser.role === 'STAFF') return;
  if (!resourceOwnerId || resourceOwnerId !== currentUser.id) {
    throw forbidden('You do not have access to this resource.');
  }
}
