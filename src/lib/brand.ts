/**
 * Single source of truth for the store brand.
 *
 * The display name lives in the database (`settings.storeName`) so the owner can
 * rename the store from Admin → Settings at any time. This constant supplies the
 * shipped default, the fallback when the database is unreachable, and the
 * historical names that a rebrand should migrate away from.
 *
 * `legacyNames` is read-only metadata: when a stored name equals one of these,
 * the store renders the current brand instead of a stale default. A name the
 * owner typed themselves is never in this list, so it is never overwritten.
 */
export const BRAND = {
  /** Current brand. Change here + in Admin → Settings to rename the store. */
  name: 'Zenvora',
  tagline: 'Considered objects, honestly priced — for the modern Indian home',
  /** Names this store has shipped under before. Used only to migrate defaults. */
  legacyNames: ['Nirvora', 'Resellix'],
  /** Fallback support address until the owner sets a real one (RFC 2606). */
  placeholderSupportEmail: 'support@example.com',
} as const;
