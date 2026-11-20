import { prisma } from '../db';
import { badRequest, forbidden } from '../errors';
import { hashPassword, verifyPassword } from '../auth/password';
import { auditLog } from '../audit';
import { randomToken } from '../crypto';
import { logger } from '../logger';

/**
 * Customer-initiated account erasure (Digital Personal Data Protection Act,
 * 2023 — right to erasure).
 *
 * What is erased immediately:
 *   - the login identity (email, name, phone, password, verification state)
 *   - all sessions and pending password-reset tokens
 *   - saved addresses, active cart, wishlist and notification bodies
 *
 * What is retained, and why:
 *   - Order, payment, refund and invoice records (8 years under Indian tax and
 *     company law, and to honour warranty/return claims). They keep their own
 *     transaction snapshots; the account they belonged to no longer identifies
 *     a real person.
 *   - The security audit entry recording this erasure (no email is stored).
 *
 * The user row itself is kept, anonymised and DISABLED, because orders and
 * audit rows reference it. Its email becomes a unique, unroutable
 * `deleted+<id>@deleted.invalid` address, so signing in or resetting the
 * password is impossible and the address can never be contacted.
 */

export const DELETION_CONFIRMATION = 'DELETE';

export const DELETED_ACCOUNT_NAME = 'Deleted account';

/** Stable, unique, non-deliverable address for an erased account. */
export function anonymizedEmailFor(userId: string): string {
  return `deleted+${userId}@deleted.invalid`;
}

export interface DeleteAccountResult {
  deleted: true;
  ordersRetained: number;
}

export async function deleteCustomerAccount(params: {
  userId: string;
  password: string;
  req?: Request;
}): Promise<DeleteAccountResult> {
  const { userId, password, req } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, passwordHash: true },
  });
  if (!user) throw badRequest('This account no longer exists.');
  if (user.role !== 'CUSTOMER') {
    throw forbidden('Staff accounts can only be closed by another administrator.');
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) throw badRequest('The password you entered is incorrect.');

  // Unpredictable hash: even if the row leaked, no password can authenticate.
  const replacementHash = await hashPassword(randomToken(32));
  const ordersRetained = await prisma.order.count({ where: { userId } });

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.passwordResetToken.deleteMany({ where: { userId } }),
    prisma.cartItem.deleteMany({ where: { cart: { userId } } }),
    prisma.cart.deleteMany({ where: { userId } }),
    prisma.address.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    // Wishlists live in the settings key-value table, keyed by the user id.
    prisma.setting.deleteMany({
      where: {
        OR: [
          { key: `wishlist:user:${userId}` },
          { key: { startsWith: `wishlist:user:${userId}:` } },
        ],
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmailFor(userId),
        name: DELETED_ACCOUNT_NAME,
        phone: null,
        passwordHash: replacementHash,
        status: 'DISABLED',
        emailVerifiedAt: null,
        lastLoginAt: null,
      },
    }),
  ]);

  // No email is recorded: the audit trail must not recreate the identifier we
  // just erased. The hashed IP still allows abuse correlation.
  await auditLog({
    actor: { id: userId, email: null },
    action: 'ACCOUNT_ERASED',
    entityType: 'User',
    entityId: userId,
    data: { ordersRetained, basis: 'DPDP Act 2023 - data principal erasure request' },
    req,
  });

  logger.info('Customer account erased by the data principal', { userId, ordersRetained });

  return { deleted: true, ordersRetained };
}
